import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { geoBounds, geoCentroid, geoEqualEarth, geoPath } from "d3-geo";
import { findCountry, getLandDots, getWorld } from "../data/world";
import { greatCircle } from "../utils/geo";
import { cx } from "../utils/cx";
import type { LatLng } from "../types";

export type VideoAspect = "16:9" | "9:16" | "1:1" | "4:5";

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
  /** "theme" uses --mr-background, "green" is chroma-key #00b140, "transparent" has alpha (PNG / WebM). */
  background?: "theme" | "green" | "transparent" | (string & {});
  variant?: "solid" | "dots";
  /** Draw a travelling route between stops. Default true. */
  route?: boolean;
  /** Seconds the camera takes to fly between stops. Default 1.6. */
  flight?: number;
  /** Seconds the camera holds on each stop. Default 1.4. */
  hold?: number;
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

const SIZES: Record<VideoAspect, [number, number]> = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:5": [4, 5] };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Canvas world map with a scripted camera, made to be recorded for YouTube, Reels and Shorts. */
export const VideoMap = forwardRef<VideoMapHandle, VideoMapProps>(function VideoMap(
  {
    stops,
    aspect = "16:9",
    resolution = 1080,
    background = "theme",
    variant = "solid",
    route = true,
    flight = 1.6,
    hold = 1.4,
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
  const unit = Math.min(W, H) / 1080; // scales strokes and type with the frame

  // Base projection fills the frame; the camera zooms into it.
  const scene = useMemo(() => {
    const world = getWorld();
    const projection = geoEqualEarth().fitExtent([[0, 0], [W, H]], { type: "Sphere" });
    if (rw < rh) projection.scale(projection.scale() * 1.6); // portrait: start closer so land fills the frame
    const path = geoPath(projection);
    const shots = stops.map((s) => {
      const c = s.country ? findCountry(s.country) : undefined;
      const pin = s.at ? [s.at.lng, s.at.lat] : c ? geoCentroid(c) : [0, 0];
      const p = projection(pin as [number, number]) ?? [W / 2, H / 2];
      let k = s.zoom ?? 4;
      if (!s.zoom && c) {
        const [[x0, y0], [x1, y1]] = path.bounds(c);
        k = clamp(0.55 / Math.max((x1 - x0) / W, (y1 - y0) / H), 1.2, 14);
        const b = geoBounds(c);
        if (b[1][0] - b[0][0] > 180 || b[0][0] > b[1][0]) k = Math.min(k, 2.2); // crosses the antimeridian
      }
      return { x: p[0], y: p[1], k, pin: pin as [number, number], label: s.label ?? c?.properties.name ?? "", id: c?.id };
    });
    const legs = shots.slice(1).map((s, i) =>
      greatCircle({ lng: shots[i].pin[0], lat: shots[i].pin[1] }, { lng: s.pin[0], lat: s.pin[1] }, 96).map(
        (ll) => projection(ll) ?? [0, 0],
      ),
    );
    const dots = variant === "dots" ? getLandDots(0.75) : null;
    return { world, projection, shots, legs, dots };
  }, [stops, W, H, rw, rh, variant]);

  const duration = Math.max(1, scene.shots.length) * (flight + hold) + 0.6;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const css = getComputedStyle(wrapRef.current!);
    const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
    const font = css.fontFamily || "system-ui, sans-serif";
    const { world, projection, shots, legs, dots } = scene;
    const path = geoPath(projection, ctx);
    let raf = 0;

    const camera = (t: number) => {
      // segment i: fly from shot i-1 to shot i during `flight`, then hold
      const seg = flight + hold;
      const i = Math.min(shots.length - 1, Math.floor(t / seg));
      const local = t - i * seg;
      const to = shots[i];
      const from = i === 0 ? { x: W / 2, y: H / 2, k: 1 } : shots[i - 1];
      const p = ease(clamp(local / flight, 0, 1));
      // zoom out mid-flight, proportional to how far apart the stops are
      const dist = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(W, H);
      const dip = Math.sin(Math.PI * p) * clamp(dist * 2.2, 0, 1.4);
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * p - dip);
      return { i, p, holdT: clamp((local - flight) / hold, 0, 1), x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, k };
    };

    const draw = (now: number) => {
      let t = Math.max(0, (now - clock.current.start) / 1000);
      if (t > duration) {
        if (clock.current.once) {
          clock.current.once = false;
          clock.current.onEnd?.();
          clock.current.onEnd = null;
        }
        if (loop) { clock.current.start = now; t = 0; } else t = duration;
      }
      const cam = shots.length ? camera(Math.min(t, duration - 0.6)) : { i: -1, p: 0, holdT: 0, x: W / 2, y: H / 2, k: 1 };
      const accent = v("--mr-accent", "#6366f1");
      const fg = v("--mr-foreground", "#111");
      const bgTheme = v("--mr-background", "#fff");

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const bg = background === "theme" ? bgTheme : background === "green" ? "#00b140" : background === "transparent" ? null : background;
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }

      // camera transform
      ctx.setTransform(cam.k, 0, 0, cam.k, W / 2 - cam.x * cam.k, H / 2 - cam.y * cam.k);
      const px = 1 / cam.k; // one screen pixel in map units
      const current = cam.i >= 0 ? shots[cam.i] : null;
      const visited = new Set(shots.slice(0, cam.i + 1).map((s) => s.id));

      if (dots) {
        const r = 2.1 * unit * px * Math.sqrt(cam.k);
        ctx.fillStyle = v("--mr-dot", "#aaa");
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
        ctx.fillStyle = v("--mr-land", "#ddd");
        ctx.fill();
        if (on || seen) {
          ctx.globalAlpha = on ? 0.25 + 0.75 * clamp(cam.p * 1.5, 0, 1) : 0.4;
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      if (!dots) {
        ctx.beginPath();
        path(world.borders);
        ctx.strokeStyle = bg && background === "theme" ? v("--mr-region-stroke", "#fff") : "rgba(255,255,255,.7)";
        ctx.lineWidth = 1.2 * unit * px;
        ctx.stroke();
      }

      // route
      if (route) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        legs.forEach((leg, j) => {
          const leg_i = j + 1; // leg into shot j+1
          if (leg_i > cam.i) return;
          const prog = leg_i < cam.i ? 1 : cam.p;
          const n = Math.max(1, Math.round(prog * (leg.length - 1)));
          ctx.beginPath();
          ctx.moveTo(leg[0][0], leg[0][1]);
          for (let q = 1; q <= n; q++) ctx.lineTo(leg[q][0], leg[q][1]);
          ctx.setLineDash([10 * unit * px, 8 * unit * px]);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 4 * unit * px;
          ctx.stroke();
          ctx.setLineDash([]);
          if (prog < 1) {
            const h = leg[n];
            ctx.fillStyle = accent;
            ctx.beginPath(); ctx.arc(h[0], h[1], 9 * unit * px, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(h[0], h[1], 4 * unit * px, 0, Math.PI * 2); ctx.fill();
          }
        });
      }

      // pins
      shots.slice(0, cam.i + 1).forEach((s, j) => {
        const arrived = j < cam.i || cam.p >= 1;
        if (!arrived) return;
        const pulse = j === cam.i ? (t * 0.8) % 1 : 1;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = (1 - pulse) * 0.8;
        ctx.lineWidth = 3 * unit * px;
        ctx.beginPath(); ctx.arc(s.x, s.y, (10 + pulse * 34) * unit * px, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.x, s.y, 12 * unit * px, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(s.x, s.y, 8 * unit * px, 0, Math.PI * 2); ctx.fill();
      });

      // overlays in screen space
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (current && cam.p >= 1 && current.label) {
        const a = ease(clamp(cam.holdT * 4, 0, 1));
        const size = 44 * unit;
        ctx.font = `600 ${size}px ${font}`;
        const tw = ctx.measureText(current.label).width;
        const padX = 28 * unit, h = size + 36 * unit;
        const bx = W / 2 - tw / 2 - padX, by = H / 2 + 40 * unit + (1 - a) * 20 * unit;
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(10,10,12,.86)";
        ctx.beginPath(); ctx.roundRect(bx, by, tw + padX * 2, h, h / 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(current.label, bx + padX, by + h / 2 + 1);
        ctx.globalAlpha = 1;
      }
      if (title) {
        const m = 64 * unit;
        ctx.fillStyle = background === "theme" ? fg : "#fff";
        ctx.textBaseline = "alphabetic";
        ctx.font = `600 ${56 * unit}px ${font}`;
        ctx.fillText(title, m, m + 52 * unit);
        if (subtitle) {
          ctx.globalAlpha = 0.7;
          ctx.font = `400 ${30 * unit}px ${font}`;
          ctx.fillText(subtitle, m, m + 100 * unit);
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, W, H, unit, flight, hold, duration, loop, route, background, title, subtitle]);

  useImperativeHandle(
    ref,
    () => ({
      duration,
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
    [duration, fps],
  );

  return (
    <div ref={wrapRef} className={cx("mr-root mr-video", className)} style={{ aspectRatio: `${W} / ${H}`, ...style }}>
      <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={title ?? "Animated map"} />
    </div>
  );
});
