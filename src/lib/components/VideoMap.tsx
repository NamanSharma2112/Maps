import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { geoBounds, geoCentroid, geoEqualEarth, geoPath } from "d3-geo";
import { findCountry, getLandDots, getWorld } from "../data/world";
import { distanceKm, greatCircle } from "../utils/geo";
import { cx } from "../utils/cx";
import type { LatLng } from "../types";

export type VideoAspect = "16:9" | "9:16" | "1:1" | "4:5";
export type VideoTheme = "auto" | "light" | "dark" | "midnight" | "sand";

export interface VideoStop {
  /** Country name (Natural Earth) — the camera frames it and it is highlighted. */
  country?: string;
  /** Or a point to fly to. With `country`, the pin goes here instead of the country centre. */
  at?: LatLng;
  /** Zoom factor at this stop. Defaults to fitting the country, or 4 for a point. */
  zoom?: number;
  /** Caption shown while the camera holds here. Defaults to the country name. */
  label?: string;
}

export interface VideoMapProps {
  stops: VideoStop[];
  /** Frame shape: 16:9 YouTube, 9:16 Reels / Shorts / TikTok, 1:1 and 4:5 feed posts. Default "16:9". */
  aspect?: VideoAspect;
  /** Pixels on the short side of the exported frame. Default 1080. */
  resolution?: number;
  /** Colour theme. "auto" follows the page's --mr-* tokens. Default "auto". */
  theme?: VideoTheme;
  /** Overrides the theme background: "green" is chroma-key #00b140, "transparent" keeps alpha (PNG / WebM). */
  background?: "theme" | "green" | "transparent" | (string & {});
  variant?: "solid" | "dots";
  /** Route between stops. Default "dashed". */
  routeStyle?: "dashed" | "solid" | "glow" | "none";
  /** What travels along the route. Default "plane". */
  vehicle?: "plane" | "dot" | "none";
  /** "pill" centred under the pin, "lower-third" broadcast-style card. Default "lower-third". */
  captionStyle?: "pill" | "lower-third" | "none";
  /** Show the running distance in captions. Default true. */
  showDistance?: boolean;
  /** Timeline bar along the bottom edge. Default true. */
  progress?: boolean;
  /** Darken the frame edges. Default true. */
  vignette?: boolean;
  /** Seconds the camera takes to fly between stops. Default 1.8. */
  flight?: number;
  /** Seconds the camera holds on each stop. Default 1.6. */
  hold?: number;
  /** Playback speed multiplier. Default 1. */
  speed?: number;
  title?: string;
  subtitle?: string;
  /** Loop the preview. Default true. */
  loop?: boolean;
  /** Frames per second for recording. Default 30. */
  fps?: number;
  className?: string;
  style?: CSSProperties;
}

export interface VideoMapHandle {
  /** Restart the animation from the first stop. */
  replay: () => void;
  /** Play the whole timeline once and record it. Resolves with a WebM (or MP4 on Safari) video. */
  record: () => Promise<Blob>;
  /** The current frame as a PNG. */
  snapshot: () => Promise<Blob>;
  /** Total length of one run in seconds. */
  duration: number;
}

interface Palette { bg: string; land: string; border: string; dot: string; accent: string; text: string; card: string; cardText: string }
const PALETTES: Record<Exclude<VideoTheme, "auto">, Palette> = {
  light: { bg: "#f6f6f7", land: "#e2e2e6", border: "#f6f6f7", dot: "#c4c4cc", accent: "#5b5bf0", text: "#0a0a0b", card: "#0a0a0b", cardText: "#ffffff" },
  dark: { bg: "#09090b", land: "#232327", border: "#09090b", dot: "#3a3a42", accent: "#8b8cff", text: "#fafafa", card: "#fafafa", cardText: "#09090b" },
  midnight: { bg: "#06101d", land: "#14243a", border: "#06101d", dot: "#25405f", accent: "#38bdf8", text: "#e6f1ff", card: "#e6f1ff", cardText: "#06101d" },
  sand: { bg: "#f2ebdf", land: "#dccdb3", border: "#f2ebdf", dot: "#c4b292", accent: "#d9480f", text: "#2a2017", card: "#2a2017", cardText: "#f2ebdf" },
};

const SIZES: Record<VideoAspect, [number, number]> = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:5": [4, 5] };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const INTRO = 0.8; // seconds of establishing shot before the first flight
const OUTRO = 1.2;
const fmtKm = (km: number) => `${Math.round(km).toLocaleString("en")} km`;

/** Canvas world map with a scripted camera, made to be recorded for YouTube, Reels and Shorts. */
export const VideoMap = forwardRef<VideoMapHandle, VideoMapProps>(function VideoMap(
  {
    stops,
    aspect = "16:9",
    resolution = 1080,
    theme = "auto",
    background = "theme",
    variant = "solid",
    routeStyle = "dashed",
    vehicle = "plane",
    captionStyle = "lower-third",
    showDistance = true,
    progress = true,
    vignette = true,
    flight = 1.8,
    hold = 1.6,
    speed = 1,
    title,
    subtitle,
    loop = true,
    fps = 30,
    className,
    style,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const clock = useRef({ start: performance.now(), once: false, onEnd: null as null | (() => void) });

  const [rw, rh] = SIZES[aspect];
  const W = Math.round(rw >= rh ? (resolution * rw) / rh : resolution);
  const H = Math.round(rw >= rh ? resolution : (resolution * rh) / rw);
  const unit = Math.min(W, H) / 1080;
  const portrait = rw < rh;

  const scene = useMemo(() => {
    const world = getWorld();
    const projection = geoEqualEarth().fitExtent([[0, 0], [W, H]], { type: "Sphere" });
    if (portrait) projection.scale(projection.scale() * 1.6);
    const path = geoPath(projection);
    const shots = stops.map((s) => {
      const c = s.country ? findCountry(s.country) : undefined;
      const pin = (s.at ? [s.at.lng, s.at.lat] : c ? geoCentroid(c) : [0, 0]) as [number, number];
      const p = projection(pin) ?? [W / 2, H / 2];
      let k = s.zoom ?? 4;
      if (!s.zoom && c) {
        const [[x0, y0], [x1, y1]] = path.bounds(c);
        k = clamp(0.5 / Math.max((x1 - x0) / W, (y1 - y0) / H), 1.2, 14);
        const b = geoBounds(c);
        if (b[1][0] - b[0][0] > 180 || b[0][0] > b[1][0]) k = Math.min(k, 2.2);
      }
      return { x: p[0], y: p[1], k, pin, label: s.label ?? c?.properties.name ?? "", id: c?.id };
    });
    const legs = shots.slice(1).map((s, i) =>
      greatCircle({ lng: shots[i].pin[0], lat: shots[i].pin[1] }, { lng: s.pin[0], lat: s.pin[1] }, 120).map((ll) => projection(ll) ?? [0, 0]),
    );
    const legKm = shots.slice(1).map((s, i) => distanceKm({ lng: shots[i].pin[0], lat: shots[i].pin[1] }, { lng: s.pin[0], lat: s.pin[1] }));
    const dots = variant === "dots" ? getLandDots(0.75) : null;
    return { world, projection, shots, legs, legKm, dots };
  }, [stops, W, H, portrait, variant]);

  const seg = flight + hold;
  const duration = INTRO + Math.max(1, scene.shots.length) * seg + OUTRO;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const css = getComputedStyle(wrapRef.current!);
    const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
    const font = css.fontFamily || "system-ui, sans-serif";
    const mono = v("--mr-font-mono", "ui-monospace, monospace");
    const pal: Palette =
      theme === "auto"
        ? { bg: v("--mr-background", "#fff"), land: v("--mr-land", "#ddd"), border: v("--mr-region-stroke", "#fff"), dot: v("--mr-dot", "#bbb"), accent: v("--mr-accent", "#6366f1"), text: v("--mr-foreground", "#111"), card: v("--mr-foreground", "#111"), cardText: v("--mr-background", "#fff") }
        : PALETTES[theme];
    const bg = background === "theme" ? pal.bg : background === "green" ? "#00b140" : background === "transparent" ? null : background;
    const overlayText = background === "theme" ? pal.text : "#ffffff";
    const lightBg = theme === "light" || theme === "sand" || (theme === "auto" && !document.documentElement.classList.contains("dark"));
    const { world, projection, shots, legs, legKm, dots } = scene;
    const path = geoPath(projection, ctx);
    let raf = 0;

    const camera = (t: number) => {
      const tt = t - INTRO;
      if (tt < 0 || !shots.length) return { i: -1, p: 0, holdT: 0, x: W / 2, y: H / 2, k: 1 + 0.04 * easeOut(clamp(t / INTRO, 0, 1)) };
      const i = Math.min(shots.length - 1, Math.floor(tt / seg));
      const local = tt - i * seg;
      const to = shots[i];
      const from = i === 0 ? { x: W / 2, y: H / 2, k: 1.04 } : shots[i - 1];
      const p = ease(clamp(local / flight, 0, 1));
      const dist = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(W, H);
      const dip = Math.sin(Math.PI * p) * clamp(dist * 2.4, 0, 1.5);
      const drift = 1 + 0.03 * clamp((local - flight) / hold, 0, 1); // slow push-in while holding
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * p - dip) * drift;
      return { i, p, holdT: clamp((local - flight) / hold, 0, 1), x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, k };
    };

    const plane = (x: number, y: number, angle: number, s: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.beginPath(); // nose points along +x
      ctx.moveTo(14, 0); ctx.lineTo(4, -2.2); ctx.lineTo(-2, -12); ctx.lineTo(-5.5, -12); ctx.lineTo(-2, -2.4);
      ctx.lineTo(-9, -2.2); ctx.lineTo(-12, -6.5); ctx.lineTo(-14, -6.5); ctx.lineTo(-12, 0); ctx.lineTo(-14, 6.5);
      ctx.lineTo(-12, 6.5); ctx.lineTo(-9, 2.2); ctx.lineTo(-2, 2.4); ctx.lineTo(-5.5, 12); ctx.lineTo(-2, 12); ctx.lineTo(4, 2.2); ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1.4; ctx.strokeStyle = pal.accent; ctx.stroke();
      ctx.restore();
    };

    const draw = (now: number) => {
      let t = Math.max(0, ((now - clock.current.start) / 1000) * speed);
      if (t > duration) {
        if (clock.current.once) { clock.current.once = false; clock.current.onEnd?.(); clock.current.onEnd = null; }
        if (loop) { clock.current.start = now; t = 0; } else t = duration;
      }
      const cam = camera(Math.min(t, duration - OUTRO));
      const fadeIn = easeOut(clamp(t / 0.5, 0, 1));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = fadeIn;

      ctx.setTransform(cam.k, 0, 0, cam.k, W / 2 - cam.x * cam.k, H / 2 - cam.y * cam.k);
      const px = 1 / cam.k;
      const current = cam.i >= 0 ? shots[cam.i] : null;
      const visited = new Set(shots.slice(0, cam.i + 1).map((s) => s.id));

      if (dots) {
        const r = 2.1 * unit * px * Math.sqrt(cam.k);
        ctx.fillStyle = pal.dot;
        ctx.beginPath();
        for (let j = 0; j < dots.length; j += 2) {
          const q = projection([dots[j], dots[j + 1]]);
          if (!q) continue;
          ctx.moveTo(q[0] + r, q[1]);
          ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      for (const c of world.countries) {
        const on = current && c.id === current.id;
        const seen = visited.has(c.id);
        if (dots && !on && !seen) continue;
        ctx.beginPath();
        path(c);
        if (on) { ctx.shadowColor = pal.accent; ctx.shadowBlur = 40 * unit; }
        ctx.fillStyle = pal.land;
        ctx.fill();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        if (on || seen) {
          ctx.globalAlpha = fadeIn * (on ? 0.3 + 0.7 * clamp(cam.p * 1.5, 0, 1) : 0.35);
          ctx.fillStyle = pal.accent;
          ctx.fill();
          ctx.globalAlpha = fadeIn;
        }
      }
      if (!dots) {
        ctx.beginPath();
        path(world.borders);
        ctx.strokeStyle = background === "theme" ? pal.border : "rgba(255,255,255,.75)";
        ctx.lineWidth = 1.2 * unit * px;
        ctx.stroke();
      }

      // route + vehicle
      let km = 0;
      legs.forEach((leg, j) => {
        const into = j + 1;
        if (into > cam.i) return;
        const prog = into < cam.i ? 1 : cam.p;
        km += legKm[j] * prog;
        const n = Math.max(1, Math.round(prog * (leg.length - 1)));
        if (routeStyle !== "none") {
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(leg[0][0], leg[0][1]);
          for (let q = 1; q <= n; q++) ctx.lineTo(leg[q][0], leg[q][1]);
          if (routeStyle === "glow") {
            ctx.strokeStyle = pal.accent; ctx.globalAlpha = fadeIn * 0.25; ctx.lineWidth = 14 * unit * px; ctx.stroke();
            ctx.globalAlpha = fadeIn;
          }
          if (routeStyle === "dashed") ctx.setLineDash([12 * unit * px, 10 * unit * px]);
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = (routeStyle === "glow" ? 3.5 : 4) * unit * px;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (prog < 1 && prog > 0 && vehicle !== "none") {
          const h = leg[n], b = leg[Math.max(0, n - 2)];
          if (vehicle === "plane") plane(h[0], h[1], Math.atan2(h[1] - b[1], h[0] - b[0]), 2.2 * unit * px);
          else {
            ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(h[0], h[1], 10 * unit * px, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(h[0], h[1], 4.5 * unit * px, 0, Math.PI * 2); ctx.fill();
          }
        }
      });

      // pins
      shots.slice(0, cam.i + 1).forEach((s, j) => {
        if (!(j < cam.i || cam.p >= 1)) return;
        const pulse = j === cam.i ? (t * 0.8) % 1 : 1;
        ctx.strokeStyle = pal.accent;
        ctx.globalAlpha = fadeIn * (1 - pulse) * 0.8;
        ctx.lineWidth = 3 * unit * px;
        ctx.beginPath(); ctx.arc(s.x, s.y, (11 + pulse * 36) * unit * px, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = fadeIn;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.x, s.y, 12 * unit * px, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(s.x, s.y, 8 * unit * px, 0, Math.PI * 2); ctx.fill();
      });

      // ── screen-space overlays ──
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      if (vignette && bg) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, lightBg && background === "theme" ? "rgba(0,0,0,.10)" : "rgba(0,0,0,.45)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      const m = 64 * unit;
      if (current && cam.p >= 1 && current.label && captionStyle !== "none") {
        const a = ease(clamp(cam.holdT * 3.5, 0, 1));
        const meta = `${String(cam.i + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}${showDistance && cam.i > 0 ? `  ·  ${fmtKm(km)}` : ""}`;
        ctx.globalAlpha = a;
        ctx.textBaseline = "middle";
        if (captionStyle === "pill") {
          const size = 44 * unit;
          ctx.font = `600 ${size}px ${font}`;
          const tw = ctx.measureText(current.label).width;
          const padX = 30 * unit, h = size + 36 * unit;
          const bx = W / 2 - tw / 2 - padX, by = H / 2 + 44 * unit + (1 - a) * 20 * unit;
          ctx.fillStyle = pal.card;
          ctx.beginPath(); ctx.roundRect(bx, by, tw + padX * 2, h, h / 2); ctx.fill();
          ctx.fillStyle = pal.cardText;
          ctx.fillText(current.label, bx + padX, by + h / 2 + 1);
        } else {
          const size = 52 * unit, metaSize = 24 * unit;
          ctx.font = `600 ${size}px ${font}`;
          const tw = ctx.measureText(current.label).width;
          ctx.font = `500 ${metaSize}px ${mono}`;
          const mw = ctx.measureText(meta).width;
          const padX = 32 * unit, padY = 26 * unit;
          const w = Math.max(tw, mw) + padX * 2 + 10 * unit, h = size + metaSize + padY * 2 + 12 * unit;
          const bx = m - (1 - a) * 40 * unit, by = H - m - h - (progress ? 24 * unit : 0) - (portrait ? 220 * unit : 0);
          ctx.fillStyle = pal.card;
          ctx.beginPath(); ctx.roundRect(bx, by, w, h, 18 * unit); ctx.fill();
          ctx.fillStyle = pal.accent;
          ctx.beginPath(); ctx.roundRect(bx + 16 * unit, by + padY, 6 * unit, h - padY * 2, 3 * unit); ctx.fill();
          ctx.fillStyle = pal.cardText;
          ctx.globalAlpha = a * 0.65;
          ctx.font = `500 ${metaSize}px ${mono}`;
          ctx.fillText(meta, bx + padX + 10 * unit, by + padY + metaSize / 2);
          ctx.globalAlpha = a;
          ctx.font = `600 ${size}px ${font}`;
          ctx.fillText(current.label, bx + padX + 10 * unit, by + padY + metaSize + 12 * unit + size / 2);
        }
        ctx.globalAlpha = 1;
      }

      if (title) {
        const a = easeOut(clamp((t - 0.2) / 0.6, 0, 1));
        ctx.globalAlpha = a;
        ctx.fillStyle = overlayText;
        ctx.textBaseline = "alphabetic";
        const top = portrait ? m + 140 * unit : m;
        ctx.font = `700 ${60 * unit}px ${font}`;
        ctx.fillText(title, m, top + 56 * unit - (1 - a) * 12 * unit);
        if (subtitle) {
          ctx.globalAlpha = a * 0.7;
          ctx.font = `400 ${30 * unit}px ${font}`;
          ctx.fillText(subtitle, m, top + 104 * unit);
        }
        ctx.globalAlpha = 1;
      }

      if (progress && shots.length) {
        const y = H - m * 0.6, x0 = m, x1 = W - m;
        const p = clamp((t - INTRO) / (shots.length * seg), 0, 1);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = overlayText;
        ctx.beginPath(); ctx.roundRect(x0, y - 3 * unit, x1 - x0, 6 * unit, 3 * unit); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.roundRect(x0, y - 3 * unit, Math.max(6 * unit, (x1 - x0) * p), 6 * unit, 3 * unit); ctx.fill();
        shots.forEach((_, j) => {
          const tx = x0 + ((x1 - x0) * (j * seg + flight)) / (shots.length * seg);
          const done = j < cam.i || (j === cam.i && cam.p >= 1);
          ctx.fillStyle = done ? pal.accent : overlayText;
          ctx.globalAlpha = done ? 1 : 0.5;
          ctx.beginPath(); ctx.arc(tx, y, 7 * unit, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, W, H, unit, portrait, seg, flight, hold, duration, speed, loop, theme, background, routeStyle, vehicle, captionStyle, showDistance, progress, vignette, title, subtitle]);

  useImperativeHandle(
    ref,
    () => ({
      duration: duration / speed,
      replay: () => { clock.current.start = performance.now(); },
      snapshot: () =>
        new Promise<Blob>((resolve, reject) =>
          canvasRef.current!.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the canvas"))), "image/png"),
        ),
      record: () =>
        new Promise<Blob>((resolve, reject) => {
          const canvas = canvasRef.current!;
          if (typeof MediaRecorder === "undefined" || !canvas.captureStream) return reject(new Error("This browser cannot record video"));
          const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
          const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
          const rec = new MediaRecorder(canvas.captureStream(fps), { mimeType, videoBitsPerSecond: 12_000_000 });
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.onstop = () => resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
          rec.onerror = () => reject(new Error("Recording failed"));
          clock.current = { start: performance.now(), once: true, onEnd: () => rec.stop() };
          rec.start(250);
        }),
    }),
    [duration, speed, fps],
  );

  return (
    <div ref={wrapRef} className={cx("mr-root mr-video", className)} style={{ aspectRatio: `${W} / ${H}`, ...style }}>
      <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={title ?? "Animated map"} />
    </div>
  );
});
