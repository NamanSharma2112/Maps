import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { geoCircle, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { getLandDots, getWorld } from "../data/world";
import { DEG, distanceKm, greatCircle } from "../utils/geo";
import { antisolarPoint } from "../utils/sun";
import { useElementSize, useInView, useReducedMotion } from "../utils/hooks";
import { cx } from "../utils/cx";
import type { LatLng, MapArc, MapMarker, MapVariant } from "../types";
import { Tooltip } from "./Tooltip";
import { MapSkeleton } from "./MapSkeleton";

export interface GlobeProps {
  /** Diameter in px. Omit to fill the container's width. */
  size?: number;
  /** Land treatment. Default "dots". */
  variant?: MapVariant;
  markers?: MapMarker[];
  arcs?: MapArc[];
  /** Degrees per second. 0 stops rotation. Default 8. */
  autoRotate?: number;
  /** Drag to spin, with inertia. Default true. */
  draggable?: boolean;
  /** Where the globe faces on first render. */
  initialView?: LatLng;
  /** Smoothly turn to face this point. Auto-rotation pauses while set. */
  focus?: LatLng | null;
  /** Latitude/longitude grid every 10°. Default false. */
  graticule?: boolean;
  /** Soft glow around the rim. Default true. */
  atmosphere?: boolean;
  /** Shade the night side. `true` uses the current time; pass a Date to fix it. */
  terminator?: boolean | Date;
  /** Degrees between land dots (dots variant). Default 1.6. */
  dotSpacing?: number;
  /** Seconds for one arc to travel and fade. Default 3.2. */
  arcDuration?: number;
  /** Draw marker labels on the globe. Default false (labels show in tooltips). */
  showLabels?: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  /** Show a skeleton instead of the globe, e.g. while your data loads. */
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

interface Vec3 { x: number; y: number; z: number }
interface Projected { sx: number; sy: number; depth: number; visible: boolean }

const toVec = (lng: number, lat: number): Vec3 => {
  const λ = lng * DEG, φ = lat * DEG, c = Math.cos(φ);
  return { x: c * Math.cos(λ), y: c * Math.sin(λ), z: Math.sin(φ) };
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Globe({
  size,
  variant = "dots",
  markers = [],
  arcs = [],
  autoRotate = 8,
  draggable = true,
  initialView = { lat: 20, lng: 10 },
  focus = null,
  graticule = false,
  atmosphere = true,
  terminator = false,
  dotSpacing = 1.6,
  arcDuration = 3.2,
  showLabels = false,
  onMarkerClick,
  loading = false,
  className,
  style,
  "aria-label": ariaLabel = "Interactive globe",
}: GlobeProps) {
  const [wrapRef, measured] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(wrapRef);
  const diameter = Math.max(0, Math.floor(size ?? measured.width));

  // Mutable animation state lives in refs so the render loop never re-subscribes.
  const rot = useRef({ λ: -initialView.lng, φ: -initialView.lat });
  const vel = useRef({ λ: 0, φ: 0 });
  const drag = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const lastInteraction = useRef(-Infinity);
  const focusAnim = useRef<{ from: { λ: number; φ: number }; to: { λ: number; φ: number }; start: number } | null>(null);
  const markerScreen = useRef<{ m: MapMarker; x: number; y: number; visible: boolean }[]>([]);
  const [hover, setHover] = useState<{ m: MapMarker; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const dots = useMemo(() => {
    if (variant !== "dots") return null;
    const flat = getLandDots(dotSpacing);
    const n = flat.length / 2;
    const v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = toVec(flat[i * 2], flat[i * 2 + 1]);
      v[i * 3] = p.x; v[i * 3 + 1] = p.y; v[i * 3 + 2] = p.z;
    }
    return v;
  }, [variant, dotSpacing]);

  const arcData = useMemo(
    () =>
      arcs.map((a, i) => {
        const km = distanceKm(a.from, a.to);
        const height = clamp((km / 20015) * 0.55, 0.05, 0.4); // in globe radii
        const pts = greatCircle(a.from, a.to, 72).map(([lng, lat], j, all) => {
          const t = j / (all.length - 1);
          return { v: toVec(lng, lat), h: 1 + height * Math.sin(Math.PI * t) };
        });
        return { arc: a, pts, delay: a.delay ?? i * 0.45 };
      }),
    [arcs],
  );

  // Smooth turn to `focus`.
  useEffect(() => {
    if (!focus) return;
    const from = { ...rot.current };
    let toλ = -focus.lng;
    // take the short way round
    while (toλ - from.λ > 180) toλ -= 360;
    while (toλ - from.λ < -180) toλ += 360;
    focusAnim.current = { from, to: { λ: toλ, φ: -focus.lat }, start: performance.now() };
    vel.current = { λ: 0, φ: 0 };
  }, [focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || diameter === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = diameter * dpr;
    canvas.height = diameter * dpr;

    const world = getWorld();
    const grat = geoGraticule10();
    const projection = geoOrthographic().precision(0.3);
    const path = geoPath(projection, ctx);
    const styles = getComputedStyle(wrap);
    const fontFamily = styles.fontFamily || "system-ui, sans-serif";

    const pad = diameter * (atmosphere ? 0.075 : 0.012);
    const R = diameter / 2 - pad;
    if (R < 4) return; // container not laid out yet
    const c = diameter / 2;

    let raf = 0;
    let last = performance.now();
    const start = last;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - start) / 1000;
      const css = (name: string) => styles.getPropertyValue(name).trim();
      const col = {
        ocean: css("--mr-ocean") || "#e8eeec",
        land: css("--mr-land") || "#c9d3d0",
        dot: css("--mr-dot") || "#8fa19d",
        border: css("--mr-region-stroke") || "#fff",
        grid: css("--mr-graticule") || "rgba(0,0,0,.07)",
        accent: css("--mr-accent") || "#6366f1",
        arc: css("--mr-arc") || css("--mr-accent") || "#6366f1",
        night: css("--mr-night") || "rgba(0,0,0,.2)",
        glow: css("--mr-atmosphere") || "rgba(31,122,128,.22)",
        surface: css("--mr-background") || "#fff",
        fg: css("--mr-foreground") || "#111",
        rim: css("--mr-rim") || "rgba(0,0,0,.08)",
      };

      // ── motion ────────────────────────────────────────────────
      const r = rot.current;
      const fa = focusAnim.current;
      if (fa) {
        const t = clamp((now - fa.start) / (reduced ? 1 : 1400), 0, 1);
        const e = easeInOut(t);
        r.λ = fa.from.λ + (fa.to.λ - fa.from.λ) * e;
        r.φ = fa.from.φ + (fa.to.φ - fa.from.φ) * e;
        if (t >= 1) focusAnim.current = null;
      } else if (!drag.current) {
        r.λ += vel.current.λ * dt;
        r.φ = clamp(r.φ + vel.current.φ * dt, -70, 70);
        const decay = Math.pow(0.04, dt); // inertia fades out over ~1s
        vel.current.λ *= decay;
        vel.current.φ *= decay;
        if (!focus && !reduced && autoRotate) {
          // ease back into auto-rotation after the user lets go
          const since = (now - lastInteraction.current) / 1000;
          const k = clamp((since - 0.6) / 1.2, 0, 1);
          r.λ += autoRotate * dt * easeOut(k);
        }
      }
      r.λ = ((r.λ + 540) % 360) - 180;

      projection.rotate([r.λ, r.φ, 0]).translate([c, c]).scale(R);
      const sλ = Math.sin(r.λ * DEG), cλ = Math.cos(r.λ * DEG);
      const sφ = Math.sin(r.φ * DEG), cφ = Math.cos(r.φ * DEG);
      const project = (v: Vec3, h = 1): Projected => {
        const x1 = v.x * cλ - v.y * sλ;
        const y1 = v.x * sλ + v.y * cλ;
        const depth = x1 * cφ - v.z * sφ;
        const up = v.z * cφ + x1 * sφ;
        const sx = c + y1 * R * h, sy = c - up * R * h;
        // a lifted point behind the globe is still visible once it clears the limb
        const visible = depth > 0 || (y1 * y1 + up * up) * h * h > 1;
        return { sx, sy, depth, visible };
      };

      // ── draw ──────────────────────────────────────────────────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, diameter, diameter);

      if (atmosphere) {
        const g = ctx.createRadialGradient(c, c, R * 0.98, c, c, R + pad);
        g.addColorStop(0, col.glow);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c, c, R + pad, 0, Math.PI * 2);
        ctx.fill();
      }

      // sphere
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fillStyle = col.ocean;
      ctx.fill();
      const shade = ctx.createRadialGradient(c - R * 0.4, c - R * 0.45, R * 0.05, c, c, R);
      shade.addColorStop(0, "rgba(255,255,255,0.10)");
      shade.addColorStop(0.65, "rgba(255,255,255,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.07)");
      ctx.fillStyle = shade;
      ctx.fill();

      if (graticule) {
        ctx.beginPath();
        path(grat);
        ctx.strokeStyle = col.grid;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      if (variant === "solid") {
        ctx.beginPath();
        path(world.land);
        ctx.fillStyle = col.land;
        ctx.fill();
        ctx.beginPath();
        path(world.borders);
        ctx.strokeStyle = col.border;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      } else if (variant === "outline") {
        ctx.beginPath();
        path(world.land);
        ctx.strokeStyle = col.dot;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else if (dots) {
        // four depth buckets → dots fade and shrink toward the limb
        const base = Math.max(0.8, R * 0.0068);
        ctx.fillStyle = col.dot;
        for (let b = 0; b < 4; b++) {
          const lo = b / 4, hi = (b + 1) / 4;
          ctx.globalAlpha = 0.28 + 0.72 * ((b + 0.5) / 4) ** 0.7;
          ctx.beginPath();
          for (let i = 0; i < dots.length; i += 3) {
            const x1 = dots[i] * cλ - dots[i + 1] * sλ;
            const depth = x1 * cφ - dots[i + 2] * sφ;
            if (depth <= lo || depth > hi) continue;
            const y1 = dots[i] * sλ + dots[i + 1] * cλ;
            const up = dots[i + 2] * cφ + x1 * sφ;
            const sx = c + y1 * R, sy = c - up * R;
            const rr = base * (0.55 + 0.45 * depth);
            ctx.moveTo(sx + rr, sy);
            ctx.arc(sx, sy, rr, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (terminator) {
        const date = terminator instanceof Date ? terminator : new Date();
        const anti = antisolarPoint(date);
        ctx.fillStyle = col.night;
        for (const radius of [90, 85, 80]) {
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          path(geoCircle().center([anti.lng, anti.lat]).radius(radius)());
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // rim
      ctx.beginPath();
      ctx.arc(c, c, R - 0.25, 0, Math.PI * 2);
      ctx.strokeStyle = col.rim;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // arcs
      ctx.lineCap = "round";
      for (const { arc, pts, delay } of arcData) {
        const color = arc.color || col.arc;
        const proj = pts.map((p) => project(p.v, p.h));
        const n = proj.length - 1;
        const strokeRun = (from: number, to: number) => {
          let open = false;
          ctx.beginPath();
          for (let j = Math.max(0, Math.floor(from)); j <= Math.min(n, Math.ceil(to)); j++) {
            const p = proj[j];
            if (!p.visible) { open = false; continue; }
            if (!open) { ctx.moveTo(p.sx, p.sy); open = true; } else ctx.lineTo(p.sx, p.sy);
          }
          ctx.stroke();
        };
        // faint full path
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1;
        strokeRun(0, n);

        let head = 1, tail = 0, land = -1;
        if (!reduced) {
          const cycle = arcDuration * 1.35;
          const p = (((time - delay) % cycle) + cycle) % cycle / arcDuration;
          if (time < delay) { head = 0; tail = 0; }
          else {
            head = easeInOut(clamp(p / 0.62, 0, 1));
            tail = easeInOut(clamp((p - 0.3) / 0.62, 0, 1));
            land = clamp((p - 0.62) / 0.38, 0, 1);
          }
        } else tail = 0;

        if (head > tail) {
          const hi = head * n, lo = tail * n;
          const a = proj[Math.round(lo)], b = proj[Math.round(hi)];
          const g = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, color);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          strokeRun(lo, hi);
          if (!reduced && head < 1 && b.visible) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.arc(b.sx, b.sy, 5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.arc(b.sx, b.sy, 2, 0, Math.PI * 2); ctx.fill();
          }
        }
        // landing ripple
        if (land > 0 && land < 1) {
          const end = proj[n];
          if (end.depth > 0) {
            ctx.strokeStyle = color;
            ctx.globalAlpha = (1 - land) * 0.8;
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(end.sx, end.sy, 3 + land * 14, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      // markers
      const screen: typeof markerScreen.current = [];
      markers.forEach((m, i) => {
        const p = project(toVec(m.lng, m.lat));
        screen.push({ m, x: p.sx, y: p.sy, visible: p.depth > 0.02 });
        if (p.depth <= 0) return;
        const fade = clamp(p.depth * 4, 0, 1);
        const color = m.color || col.accent;
        const rad = m.size ?? 3.5;
        if (m.pulse !== false && !reduced) {
          const ph = ((time + i * 0.37) % 2.4) / 2.4;
          ctx.globalAlpha = fade * (1 - ph) * 0.55;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, rad + ph * 13, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = fade;
        ctx.fillStyle = col.surface;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad + 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2); ctx.fill();
        if (showLabels && m.label) {
          ctx.font = `500 11px ${fontFamily}`;
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = col.surface;
          ctx.strokeText(m.label, p.sx + rad + 6, p.sy);
          ctx.fillStyle = col.fg;
          ctx.fillText(m.label, p.sx + rad + 6, p.sy);
        }
        ctx.globalAlpha = 1;
      });
      markerScreen.current = screen;

      raf = requestAnimationFrame(frame);
    };

    if (inView) raf = requestAnimationFrame(frame);
    else frame(performance.now()), cancelAnimationFrame(raf);
    return () => cancelAnimationFrame(raf);
  }, [diameter, variant, dots, arcData, markers, autoRotate, focus, graticule, atmosphere, terminator, arcDuration, showLabels, reduced, inView, wrapRef]);

  // ── interaction ─────────────────────────────────────────────
  const hitTest = useCallback((x: number, y: number) => {
    let best: (typeof markerScreen.current)[number] | null = null;
    let bestD = 14;
    for (const s of markerScreen.current) {
      if (!s.visible) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }, []);

  const local = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable || e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    focusAnim.current = null;
    vel.current = { λ: 0, φ: 0 };
    setDragging(true);
    setHover(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const now = performance.now();
      const k = 140 / Math.max(diameter, 1); // degrees per px
      const dλ = (e.clientX - d.x) * k, dφ = (e.clientY - d.y) * k;
      rot.current.λ += dλ;
      rot.current.φ = clamp(rot.current.φ - dφ, -70, 70);
      const dt = Math.max(1, now - d.t) / 1000;
      vel.current = { λ: dλ / dt, φ: -dφ / dt };
      drag.current = { ...d, x: e.clientX, y: e.clientY, t: now };
      lastInteraction.current = now;
      return;
    }
    const { x, y } = local(e);
    const hit = hitTest(x, y);
    setHover(hit ? { m: hit.m, x: hit.x, y: hit.y } : null);
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (performance.now() - d.t > 80) vel.current = { λ: 0, φ: 0 }; // released while still
    drag.current = null;
    lastInteraction.current = performance.now();
    setDragging(false);
  };
  const onClick = (e: React.MouseEvent) => {
    if (!onMarkerClick) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) onMarkerClick(hit.m);
  };

  return (
    <div
      ref={wrapRef}
      className={cx("mr-root mr-globe", dragging && "is-dragging", draggable && "is-draggable", hover && onMarkerClick && "is-pointing", className)}
      style={{ ...(size ? { width: size } : null), ...style }}
    >
      {(loading || diameter === 0) && <MapSkeleton shape="globe" label="Loading globe" style={{ position: "absolute", inset: 0 }} />}
      <canvas
        ref={canvasRef}
        hidden={loading}
        role="img"
        aria-label={ariaLabel}
        style={{ width: diameter, height: diameter }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
      />
      {hover && (
        <Tooltip x={hover.x} y={hover.y} title={hover.m.label ?? `${hover.m.lat.toFixed(2)}, ${hover.m.lng.toFixed(2)}`}>
          {hover.m.description}
        </Tooltip>
      )}
    </div>
  );
}
