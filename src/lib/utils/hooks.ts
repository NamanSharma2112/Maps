import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Tracks `prefers-reduced-motion: reduce`. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Content-box size of an element, updated on resize. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** True while the element is on screen — used to pause animation loops off-screen. */
export function useInView<T extends Element>(ref: React.RefObject<T>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "64px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

/** Re-renders every `ms` milliseconds and returns the current Date. */
export function useNow(ms = 1000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

let uid = 0;
/** Stable unique id (React 17-safe alternative to useId for SVG defs). */
export function useUid(prefix = "mr") {
  const [id] = useState(() => `${prefix}-${++uid}`);
  return id;
}
