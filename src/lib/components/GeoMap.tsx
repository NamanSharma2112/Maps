import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { geoPath } from "d3-geo";
import type { GeoPath, GeoPermissibleObjects, GeoProjection } from "d3-geo";
import { locate } from "../data/regions";
import type { Region, RegionFeature } from "../data/regions";
import { createColorScale, formatNumber } from "../utils/scale";
import type { ScaleType } from "../utils/scale";
import { useElementSize, useReducedMotion } from "../utils/hooks";
import { cx } from "../utils/cx";
import type { MapArc, MapBubble, MapMarker } from "../types";
import { Tooltip } from "./Tooltip";
import { MapLegend } from "./MapLegend";
import { MapControls } from "./MapControls";
import { MapSkeleton } from "./MapSkeleton";

/** Props shared by WorldMap, IndiaMap and ContinentMap. */
export interface BaseMapProps {
  /** "solid" fills each region; "dots" draws a hexagonal dot lattice; "outline" draws borders only. */
  variant?: "solid" | "dots" | "outline";
  /** Values keyed by region name or id. Turns the map into a choropleth. */
  data?: Record<string, number>;
  /** How values are split into color bins. Default "quantile". */
  scale?: ScaleType;
  /** Number of color bins. Default 5. */
  steps?: number;
  /** Custom bin colors, lightest → darkest. Overrides `steps`. */
  colors?: string[];
  /** Name of the value, shown in the tooltip and legend. */
  valueLabel?: string;
  formatValue?: (value: number) => string;
  markers?: MapMarker[];
  arcs?: MapArc[];
  /** Marker pulse. Default "always". */
  markerPulse?: "always" | "hover" | "none";
  /** Show a legend for `data`. Pass a string to title it. */
  legend?: boolean | string;
  /** Corner for the legend. Default "bottom-left". */
  legendPosition?: "bottom-left" | "top-left";
  /** Scroll to zoom, drag to pan, click a region to fly to it. */
  zoomable?: boolean;
  /** Zoom buttons (defaults to `zoomable`). */
  controls?: boolean;
  /** Maximum zoom factor. Default 8. */
  maxZoom?: number;
  /** Highlight a region by name or id. */
  selected?: string | null;
  onRegionClick?: (region: Region) => void;
  onRegionHover?: (region: Region | null) => void;
  /** Distance between dots in px (dots variant). Default 7. */
  dotGap?: number;
  /** Hover highlight and tooltips. Default true. */
  interactive?: boolean;
  /** Seconds for one arc to travel. Default 2.8. */
  arcDuration?: number;
  /** What travels along each arc. Default "dot". */
  arcVehicle?: "dot" | "plane";
  /** Proportional symbols: circle area (or spike height) scales with value. */
  bubbles?: MapBubble[];
  /** Default "circle". */
  bubbleStyle?: "circle" | "spike";
  /** Largest bubble radius (or spike height / 3) in px. Default 26. */
  bubbleSize?: number;
  /** Replace the default tooltip content. */
  renderTooltip?: (region: Region) => ReactNode;
  /** Show a skeleton instead of the map, e.g. while your data loads. */
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export interface GeoMapProps extends BaseMapProps {
  regions: RegionFeature[];
  /** Neighbouring areas drawn faded for context, without interaction. */
  context?: RegionFeature[];
  projection: () => GeoProjection;
  /** Geometry the projection is fitted to. */
  fit: GeoPermissibleObjects;
  /** Width / height. Derived from `fit` when omitted. */
  aspect?: number;
  /** Extra layers drawn under the regions (graticule) or over them (night shade). */
  underlay?: (path: GeoPath) => ReactNode;
  overlay?: (path: GeoPath) => ReactNode;
  /** Short region labels (e.g. state codes) at region centres. */
  labels?: boolean;
  labelOf?: (region: RegionFeature) => string;
  /** Small credit line in the bottom-right corner. */
  attribution?: string;
  /** Inner padding around the fitted area, as a fraction of the width. */
  fitPadding?: number;
  /** Fill for regions without data (defaults to the land or dot token). */
  regionFill?: string;
}

interface Transform { k: number; x: number; y: number }
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };
const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const r2 = (n: number) => Math.round(n * 100) / 100;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; setV(value); return; }
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function GeoMap({
  regions,
  context = [],
  projection: makeProjection,
  fit,
  aspect: aspectProp,
  underlay,
  overlay,
  labels = false,
  labelOf = (r) => r.id,
  attribution,
  fitPadding = 0,
  regionFill,
  variant = "solid",
  data,
  scale = "quantile",
  steps = 5,
  colors,
  valueLabel,
  formatValue = formatNumber,
  markers = [],
  arcs = [],
  markerPulse = "always",
  legend = false,
  legendPosition = "bottom-left",
  zoomable = false,
  controls,
  maxZoom = 8,
  selected,
  onRegionClick,
  onRegionHover,
  dotGap = 7,
  interactive = true,
  arcDuration = 2.8,
  arcVehicle = "dot",
  bubbles = [],
  bubbleStyle = "circle",
  bubbleSize = 26,
  renderTooltip,
  loading = false,
  className,
  style,
  "aria-label": ariaLabel = "Map",
}: GeoMapProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();

  // ── geometry ───────────────────────────────────────────────
  const aspect = useMemo(() => {
    if (aspectProp) return aspectProp;
    const p = makeProjection().fitWidth(1000, fit);
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds(fit);
    return (x1 - x0) / Math.max(1, y1 - y0);
  }, [aspectProp, makeProjection, fit]);

  const width = Math.round(size.width);
  const height = Math.round(width / aspect);

  const projection = useMemo(() => {
    const pad = Math.max(1, Math.round(width * fitPadding));
    return makeProjection().fitExtent([[pad, pad], [Math.max(pad + 1, width - pad), Math.max(pad + 1, height - pad)]], fit);
  }, [makeProjection, fit, width, height, fitPadding]);
  const path = useMemo(() => geoPath(projection), [projection]);

  const regionPaths = useMemo(() => regions.map((r) => path(r.geometry) ?? ""), [regions, path]);
  const contextPaths = useMemo(() => context.map((r) => path(r.geometry) ?? ""), [context, path]);
  const centroids = useMemo(
    () => regions.map((r) => { const c = path.centroid(r.geometry); return { x: c[0], y: c[1], area: path.area(r.geometry) }; }),
    [regions, path],
  );

  // Dot lattice, built at a debounced width and scaled while resizing.
  const dotWidth = useDebounced(width, 160);
  const dots = useMemo(() => {
    if (variant !== "dots" || dotWidth < 10) return null;
    const h = Math.round(dotWidth / aspect);
    const pad = Math.max(1, Math.round(dotWidth * fitPadding));
    const proj = makeProjection().fitExtent([[pad, pad], [dotWidth - pad, h - pad]], fit);
    const gap = Math.max(3, dotGap);
    const rad = r2(gap * 0.32);
    const rowH = (gap * Math.sqrt(3)) / 2;
    const byRegion: string[][] = regions.map(() => []);
    const ctx: string[] = [];
    for (let row = 0, y = rowH / 2; y < h; row++, y += rowH) {
      for (let x = gap / 2 + (row % 2 ? gap / 2 : 0); x < dotWidth; x += gap) {
        const ll = proj.invert?.([x, y]);
        if (!ll || !Number.isFinite(ll[0])) continue;
        const back = proj(ll);
        if (!back || Math.abs(back[0] - x) > 0.5 || Math.abs(back[1] - y) > 0.5) continue;
        const d = `M${r2(x - rad)} ${r2(y)}a${rad} ${rad} 0 1 0 ${r2(rad * 2)} 0a${rad} ${rad} 0 1 0 ${r2(-rad * 2)} 0`;
        const i = locate(regions, ll[0], ll[1]);
        if (i >= 0) byRegion[i].push(d);
        else if (context.length && locate(context, ll[0], ll[1]) >= 0) ctx.push(d);
      }
    }
    return { width: dotWidth, regions: byRegion.map((a) => a.join("")), context: ctx.join("") };
  }, [variant, dotWidth, aspect, makeProjection, fit, fitPadding, dotGap, regions, context]);

  // ── data ───────────────────────────────────────────────────
  const values = useMemo(() => {
    if (!data) return null;
    const lookup = new Map<string, number>();
    for (const [k, v] of Object.entries(data)) lookup.set(k.toLowerCase(), v);
    return regions.map((r) => lookup.get(r.id.toLowerCase()) ?? lookup.get(r.name.toLowerCase()));
  }, [data, regions]);
  const colorScale = useMemo(
    () => (values ? createColorScale(values.filter((v): v is number => v !== undefined), { steps, type: scale, colors }) : null),
    [values, steps, scale, colors],
  );
  const regionInfo = useCallback((i: number): Region => ({ id: regions[i].id, name: regions[i].name, value: values?.[i] }), [regions, values]);

  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    const k = selected.toLowerCase();
    return regions.findIndex((r) => r.id.toLowerCase() === k || r.name.toLowerCase() === k);
  }, [selected, regions]);

  // ── zoom & pan ─────────────────────────────────────────────
  const [t, setT] = useState<Transform>(IDENTITY);
  const tRef = useRef(t);
  tRef.current = t;
  const anim = useRef(0);
  const [focused, setFocused] = useState(-1);

  const clampT = useCallback(
    ({ k, x, y }: Transform): Transform => {
      const kk = Math.min(maxZoom, Math.max(1, k));
      return { k: kk, x: Math.min(0, Math.max(width - width * kk, x)), y: Math.min(0, Math.max(height - height * kk, y)) };
    },
    [width, height, maxZoom],
  );

  const animateTo = useCallback(
    (target: Transform) => {
      cancelAnimationFrame(anim.current);
      const to = clampT(target);
      if (reduced) return setT(to);
      const from = tRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 700);
        const e = easeInOutQuint(p);
        // interpolate in log-scale space for an even feel
        const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e);
        const cx0 = (width / 2 - from.x) / from.k, cy0 = (height / 2 - from.y) / from.k;
        const cx1 = (width / 2 - to.x) / to.k, cy1 = (height / 2 - to.y) / to.k;
        const ccx = cx0 + (cx1 - cx0) * e, ccy = cy0 + (cy1 - cy0) * e;
        setT({ k, x: width / 2 - ccx * k, y: height / 2 - ccy * k });
        if (p < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [clampT, reduced, width, height],
  );
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const zoomBy = useCallback(
    (factor: number, at?: [number, number]) => {
      const cur = tRef.current;
      const [px, py] = at ?? [width / 2, height / 2];
      const k = Math.min(maxZoom, Math.max(1, cur.k * factor));
      return { k, x: px - ((px - cur.x) / cur.k) * k, y: py - ((py - cur.y) / cur.k) * k };
    },
    [width, height, maxZoom],
  );

  const reset = useCallback(() => { setFocused(-1); animateTo(IDENTITY); }, [animateTo]);

  // reset zoom when the map is resized
  useEffect(() => { cancelAnimationFrame(anim.current); setT(IDENTITY); setFocused(-1); }, [width, height]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const rect = svg.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
      setT(clampT(zoomBy(factor, [e.clientX - rect.left, e.clientY - rect.top])));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomable, clampT, zoomBy]);

  const pan = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [panning, setPanning] = useState(false);

  // ── hover ──────────────────────────────────────────────────
  const [hover, setHover] = useState<{ kind: "region" | "marker" | "bubble"; i: number; x: number; y: number } | null>(null);
  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const setRegionHover = (i: number, x: number, y: number) => {
    setHover((h) => {
      if (!h || h.kind !== "region" || h.i !== i) onRegionHover?.(regionInfo(i));
      return { kind: "region", i, x, y };
    });
  };
  const clearHover = () => {
    setHover((h) => {
      if (h?.kind === "region") onRegionHover?.(null);
      return null;
    });
  };

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    suppressClick.current = false;
    if (!zoomable || e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    pan.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  };
  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    if (!p.moved) {
      p.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
      setPanning(true);
      clearHover();
    }
    p.x = e.clientX; p.y = e.clientY;
    const cur = tRef.current;
    setT(clampT({ k: cur.k, x: cur.x + dx, y: cur.y + dy }));
  };
  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p || p.id !== e.pointerId) return;
    suppressClick.current = p.moved;
    pan.current = null;
    setPanning(false);
  };

  const activateRegion = (i: number) => {
    onRegionClick?.(regionInfo(i));
    if (!zoomable) return;
    if (focused === i) return reset();
    const [[x0, y0], [x1, y1]] = path.bounds(regions[i].geometry);
    const k = Math.min(maxZoom, 0.72 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    setFocused(i);
    animateTo({ k, x: width / 2 - ((x0 + x1) / 2) * k, y: height / 2 - ((y0 + y1) / 2) * k });
  };

  // ── render helpers ─────────────────────────────────────────
  const fillOf = (i: number) =>
    colorScale?.colorOf(values?.[i]) ??
    (variant === "outline" ? "transparent" : regionFill ?? (variant === "dots" ? "var(--mr-dot)" : "var(--mr-land)"));
  const hoverRegion = hover?.kind === "region" ? hover.i : -1;
  const canClick = interactive && (!!onRegionClick || zoomable);
  const project = (lng: number, lat: number) => {
    const p = projection([lng, lat]);
    return p ? { x: p[0] * t.k + t.x, y: p[1] * t.k + t.y } : null;
  };
  const dotScale = dots ? width / dots.width : 1;
  const showControls = controls ?? zoomable;

  const regionEvents = (i: number) =>
    interactive
      ? {
          onPointerMove: (e: React.PointerEvent) => { if (!pan.current?.moved) { const p = localPoint(e); setRegionHover(i, p.x, p.y); } },
          onPointerLeave: clearHover,
          onClick: () => { if (!suppressClick.current) activateRegion(i); },
          ...(canClick
            ? {
                tabIndex: 0,
                role: "button",
                "aria-label": `${regions[i].name}${values?.[i] !== undefined ? `, ${formatValue(values[i]!)}` : ""}`,
                onFocus: () => setRegionHover(i, centroids[i].x * t.k + t.x, centroids[i].y * t.k + t.y),
                onBlur: clearHover,
                onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateRegion(i); } },
              }
            : {}),
        }
      : {};

  const tooltip = (() => {
    if (!hover || !interactive) return null;
    if (hover.kind === "bubble") {
      const b = bubbles[hover.i];
      const p = b && project(b.lng, b.lat);
      if (!p) return null;
      return (
        <Tooltip x={p.x} y={p.y - (bubbleStyle === "spike" ? 0 : 6)} title={b.label ?? "Value"} swatch={b.color ?? "var(--mr-accent)"}>
          <div className="mr-tooltip__row"><span>{valueLabel ?? "Value"}</span><b>{formatValue(b.value)}</b></div>
        </Tooltip>
      );
    }
    if (hover.kind === "marker") {
      const m = markers[hover.i];
      const p = m && project(m.lng, m.lat);
      if (!p) return null;
      return (
        <Tooltip x={p.x} y={p.y} title={m.label ?? "Location"} swatch={m.color ?? "var(--mr-accent)"}>
          {m.description}
        </Tooltip>
      );
    }
    const info = regionInfo(hover.i);
    const flip = hover.x > width - 180;
    return (
      <div
        className="mr-tooltip is-follow"
        role="tooltip"
        style={{ left: hover.x, top: hover.y, transform: flip ? "translate(calc(-100% - 14px), 14px)" : undefined }}
      >
        {renderTooltip ? renderTooltip(info) : (
          <>
            <div className="mr-tooltip__title">
              {colorScale && <span className="mr-tooltip__swatch" style={{ background: fillOf(hover.i) }} />}
              {info.name}
            </div>
            {values && (
              <div className="mr-tooltip__body">
                <div className="mr-tooltip__row">
                  <span>{valueLabel ?? "Value"}</span>
                  <b>{info.value !== undefined ? formatValue(info.value) : "No data"}</b>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  })();

  return (
    <div
      ref={wrapRef}
      className={cx("mr-root mr-map", variant === "outline" && "is-outline", context.length > 0 && "has-context", attribution && "has-attribution", zoomable && "is-zoomable", panning && "is-panning", hoverRegion >= 0 && "has-hover", className)}
      style={{ aspectRatio: String(aspect), ...style }}
    >
      {(loading || width === 0 || (variant === "dots" && !dots)) && (
        <MapSkeleton aspect={aspect} style={{ position: "absolute", inset: 0 }} />
      )}
      {width > 0 && !loading && (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          onDoubleClick={(e) => { if (zoomable) { const p = localPoint(e); animateTo(zoomBy(2, [p.x, p.y])); } }}
        >
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            {underlay?.(path)}

            {variant !== "dots" ? (
              <>
                {contextPaths.map((d, i) => <path key={`c${i}`} d={d} className="mr-region is-context" />)}
                {regionPaths.map((d, i) => (
                  <path
                    key={regions[i].id}
                    d={d}
                    className={cx("mr-region mr-enter", canClick && "is-interactive", hoverRegion === i && "is-hover", selectedIndex === i && "is-selected")}
                    style={{ fill: fillOf(i), animationDelay: `${Math.round((centroids[i].x / Math.max(1, width)) * 450)}ms` }}
                    {...regionEvents(i)}
                  />
                ))}
              </>
            ) : dots ? (
              <g transform={dotScale !== 1 ? `scale(${dotScale})` : undefined}>
                {dots.context && <path d={dots.context} className="mr-dots is-context" style={{ fill: "var(--mr-dot)" }} />}
                {dots.regions.map((d, i) =>
                  d ? (
                    <path
                      key={regions[i].id}
                      d={d}
                      className={cx("mr-dots mr-enter", hoverRegion === i && "is-hover")}
                      style={{ fill: selectedIndex === i ? "var(--mr-accent)" : fillOf(i), animationDelay: `${Math.round((centroids[i].x / Math.max(1, width)) * 450)}ms` }}
                    />
                  ) : null,
                )}
              </g>
            ) : null}

            {/* invisible hit areas so the gaps between dots still respond */}
            {variant === "dots" && interactive &&
              regionPaths.map((d, i) => <path key={`h${i}`} d={d} className="mr-hit" {...regionEvents(i)} />)}

            {overlay?.(path)}
          </g>

          {labels &&
            centroids.map((c, i) =>
              c.area * t.k * t.k > 700 && Number.isFinite(c.x) ? (
                <text key={`l${i}`} className="mr-region-label" x={r2(c.x * t.k + t.x)} y={r2(c.y * t.k + t.y)}>
                  {labelOf(regions[i])}
                </text>
              ) : null,
            )}

          {bubbles.length > 0 && (() => {
            const max = Math.max(...bubbles.map((b) => Math.abs(b.value)), 1);
            return (
              <g className="mr-bubbles">
                {[...bubbles.map((b, i) => ({ b, i }))]
                  .sort((a, z) => Math.abs(z.b.value) - Math.abs(a.b.value))
                  .map(({ b, i }) => {
                    const p = project(b.lng, b.lat);
                    if (!p) return null;
                    const color = b.color ?? "var(--mr-accent)";
                    const ev = interactive
                      ? { onPointerEnter: () => setHover({ kind: "bubble", i, x: p.x, y: p.y }), onPointerLeave: clearHover }
                      : {};
                    if (bubbleStyle === "spike") {
                      const h = Math.sqrt(Math.abs(b.value) / max) * bubbleSize * 3;
                      const w = Math.max(3, bubbleSize * 0.28);
                      return (
                        <path key={i} className="mr-spike" d={`M${r2(p.x - w)} ${r2(p.y)}L${r2(p.x)} ${r2(p.y - h)}L${r2(p.x + w)} ${r2(p.y)}Z`}
                          style={{ fill: color, stroke: color, animationDelay: `${(i % 20) * 40}ms` }} {...ev} />
                      );
                    }
                    const r = Math.max(2, Math.sqrt(Math.abs(b.value) / max) * bubbleSize);
                    return (
                      <circle key={i} className="mr-bubble" cx={r2(p.x)} cy={r2(p.y)} r={r2(r)}
                        style={{ fill: color, stroke: color, animationDelay: `${(i % 20) * 40}ms` }} {...ev} />
                    );
                  })}
              </g>
            );
          })()}

          {arcs.length > 0 && <ArcLayer arcs={arcs} project={project} duration={arcDuration} reduced={reduced} vehicle={arcVehicle} />}

          {markers.map((m, i) => {
            const p = project(m.lng, m.lat);
            if (!p) return null;
            const r = m.size ?? 3.5;
            const color = m.color ?? "var(--mr-accent)";
            const pulse = m.pulse === false ? "none" : markerPulse;
            return (
              <g
                key={m.id ?? i}
                className={cx("mr-marker", hover?.kind === "marker" && hover.i === i && "is-hover")}
                transform={`translate(${r2(p.x)} ${r2(p.y)})`}
                onPointerEnter={() => interactive && setHover({ kind: "marker", i, x: p.x, y: p.y })}
                onPointerLeave={clearHover}
              >
                {pulse !== "none" && !reduced && (
                  <circle r={r} className={cx("mr-marker__pulse", pulse === "hover" && "on-hover")} style={{ stroke: color, animationDelay: `${(i * 0.37) % 2.4}s` }} />
                )}
                <circle r={r + 1.5} className="mr-marker__halo" />
                <circle r={r} style={{ fill: color }} />
                <circle r={Math.max(10, r + 6)} fill="transparent" />
                {m.label && markers.length <= 12 && (
                  <text
                    className="mr-marker__label"
                    x={m.labelPosition === "left" ? -(r + 6) : m.labelPosition === "top" || m.labelPosition === "bottom" ? 0 : r + 6}
                    y={m.labelPosition === "top" ? -(r + 9) : m.labelPosition === "bottom" ? r + 9 : 0}
                    textAnchor={m.labelPosition === "left" ? "end" : m.labelPosition === "top" || m.labelPosition === "bottom" ? "middle" : "start"}
                  >
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {tooltip}

      {legend && colorScale && (
        <div className={cx("mr-map__legend", legendPosition === "top-left" && "is-top")}>
          <MapLegend
            title={typeof legend === "string" ? legend : valueLabel}
            colors={colorScale.colors}
            min={colorScale.min}
            max={colorScale.max}
            format={formatValue}
          />
        </div>
      )}

      {showControls && (
        <div className="mr-map__controls">
          <MapControls
            onZoomIn={() => animateTo(zoomBy(1.6))}
            onZoomOut={() => animateTo(zoomBy(1 / 1.6))}
            onReset={reset}
            canZoomIn={t.k < maxZoom - 0.01}
            canZoomOut={t.k > 1.01}
          />
        </div>
      )}

      {attribution && <div className="mr-map__attribution">{attribution}</div>}
    </div>
  );
}

/* ── arcs ─────────────────────────────────────────────────── */

interface ArcLayerProps {
  arcs: MapArc[];
  project: (lng: number, lat: number) => { x: number; y: number } | null;
  duration: number;
  reduced: boolean;
  vehicle: "dot" | "plane";
}

/** A small plane pointing along +x, centred on the origin. */
const PLANE_PATH = "M7.5 0L2.2 -1.2L-1 -6.4L-2.9 -6.4L-1 -1.3L-4.8 -1.2L-6.3 -3.4L-7.4 -3.4L-6.4 0L-7.4 3.4L-6.3 3.4L-4.8 1.2L-1 1.3L-2.9 6.4L-1 6.4L2.2 1.2Z";

function ArcLayer({ arcs, project, duration, reduced, vehicle }: ArcLayerProps) {
  const trails = useRef<(SVGPathElement | null)[]>([]);
  const heads = useRef<(SVGGElement | null)[]>([]);
  const ripples = useRef<(SVGCircleElement | null)[]>([]);
  const startRef = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  const geo = arcs.map((a) => {
    const p0 = project(a.from.lng, a.from.lat);
    const p1 = project(a.to.lng, a.to.lat);
    if (!p0 || !p1) return null;
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    // bow every arc upward, by a quarter of its length
    let nx = -dy / (len || 1), ny = dx / (len || 1);
    if (ny > 0) { nx = -nx; ny = -ny; }
    const cxp = mx + nx * len * 0.28, cyp = my + ny * len * 0.28;
    return { d: `M${r2(p0.x)} ${r2(p0.y)}Q${r2(cxp)} ${r2(cyp)} ${r2(p1.x)} ${r2(p1.y)}`, end: p1 };
  });

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = startRef.current;
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
    const tick = (now: number) => {
      const time = (now - start) / 1000;
      arcs.forEach((a, i) => {
        const trail = trails.current[i], head = heads.current[i], ripple = ripples.current[i];
        if (!trail) return;
        const delay = a.delay ?? i * 0.45;
        const cycle = duration * 1.35;
        let headP = 0, tailP = 0, land = -1;
        if (time >= delay) {
          const p = (((time - delay) % cycle) / duration);
          headP = ease(clamp01(p / 0.62));
          tailP = ease(clamp01((p - 0.3) / 0.62));
          land = clamp01((p - 0.62) / 0.38);
        }
        const L = trail.getTotalLength();
        const vis = Math.max(0, headP - tailP);
        trail.style.strokeDasharray = `${vis * L} ${L * 2}`;
        trail.style.strokeDashoffset = String(-tailP * L);
        trail.style.opacity = vis > 0.001 ? "1" : "0";
        if (head) {
          const show = headP > 0 && headP < 1;
          head.style.opacity = show ? "1" : "0";
          if (show) {
            const pt = trail.getPointAtLength(headP * L);
            const ahead = trail.getPointAtLength(Math.min(L, headP * L + 1));
            const behind = trail.getPointAtLength(Math.max(0, headP * L - 1));
            const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
            head.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${angle})`);
          }
        }
        if (ripple) {
          const on = land > 0 && land < 1;
          ripple.style.opacity = on ? String((1 - land) * 0.8) : "0";
          if (on) ripple.setAttribute("r", String(3 + land * 14));
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [arcs, duration, reduced]);

  return (
    <g className="mr-arcs" pointerEvents="none">
      {geo.map((g, i) => {
        if (!g) return null;
        const color = arcs[i].color ?? "var(--mr-arc, var(--mr-accent))";
        return (
          <g key={arcs[i].id ?? i}>
            <path d={g.d} className="mr-arc__base" style={{ stroke: color }} />
            <path
              ref={(el) => { trails.current[i] = el; }}
              d={g.d}
              className="mr-arc__trail"
              style={{ stroke: color, opacity: reduced ? 1 : 0 }}
            />
            {!reduced && (
              <>
                <g ref={(el) => { heads.current[i] = el; }} style={{ opacity: 0 }}>
                  {vehicle === "plane" ? (
                    <path d={PLANE_PATH} className="mr-arc__plane" style={{ stroke: color }} />
                  ) : (
                    <circle r={2.25} style={{ fill: color }} />
                  )}
                </g>
                <circle ref={(el) => { ripples.current[i] = el; }} cx={g.end.x} cy={g.end.y} r={3} className="mr-arc__ripple" style={{ stroke: color, opacity: 0 }} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
