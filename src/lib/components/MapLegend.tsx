import { formatNumber } from "../utils/scale";
import { cx } from "../utils/cx";

export interface MapLegendProps {
  title?: string;
  /** Sequential legend: bin colors, lightest → darkest. */
  colors?: string[];
  min?: number;
  max?: number;
  format?: (value: number) => string;
  /** Categorical legend: labelled swatches. Used instead of `colors`. */
  items?: { label: string; color: string }[];
  className?: string;
}

/** Sequential color ramp or categorical key, matching the map's color tokens. */
export function MapLegend({ title, colors, min, max, format = formatNumber, items, className }: MapLegendProps) {
  return (
    <div className={cx("mr-root mr-legend", className)}>
      {title && <div className="mr-legend__title">{title}</div>}
      {items ? (
        <div className="mr-legend__items">
          {items.map((it) => (
            <span key={it.label} className="mr-legend__item">
              <span className="mr-legend__dot" style={{ background: it.color }} />
              {it.label}
            </span>
          ))}
        </div>
      ) : colors ? (
        <>
          <div className="mr-legend__bins">
            {colors.map((c, i) => <span key={i} className="mr-legend__bin" style={{ background: c }} />)}
          </div>
          {min !== undefined && max !== undefined && (
            <div className="mr-legend__scale">
              <span>{format(min)}</span>
              <span>{format(max)}</span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
