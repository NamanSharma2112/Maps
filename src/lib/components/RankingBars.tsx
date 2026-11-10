import { useMemo } from "react";
import { cx } from "../utils/cx";
import { formatNumber } from "../utils/scale";

export interface RankingBarsProps {
  /** Values keyed by label, or a list of rows. */
  data: Record<string, number> | { label: string; value: number; color?: string }[];
  /** Show only the top N. Default 10. */
  limit?: number;
  title?: string;
  format?: (value: number) => string;
  /** Label to emphasise, e.g. the region hovered on a linked map. */
  highlight?: string | null;
  onHover?: (label: string | null) => void;
  className?: string;
}

/** Animated horizontal bar ranking that pairs with a choropleth map. */
export function RankingBars({ data, limit = 10, title, format = formatNumber, highlight, onHover, className }: RankingBarsProps) {
  const rows = useMemo(() => {
    const list: { label: string; value: number; color?: string }[] = Array.isArray(data)
      ? data
      : Object.entries(data).map(([label, value]) => ({ label, value }));
    return [...list].sort((a, b) => b.value - a.value).slice(0, limit);
  }, [data, limit]);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const hl = highlight?.toLowerCase();
  return (
    <div className={cx("mr-root mr-ranking", hl && "has-highlight", className)}>
      {title && <div className="mr-ranking__title">{title}</div>}
      <ol className="mr-ranking__list">
        {rows.map((r, i) => (
          <li
            key={r.label}
            className={cx("mr-ranking__row", hl === r.label.toLowerCase() && "is-active")}
            onPointerEnter={() => onHover?.(r.label)}
            onPointerLeave={() => onHover?.(null)}
          >
            <span className="mr-ranking__rank">{i + 1}</span>
            <span className="mr-ranking__label">{r.label}</span>
            <span className="mr-ranking__value">{format(r.value)}</span>
            <span className="mr-ranking__track">
              <span
                className="mr-ranking__bar"
                style={{ width: `${(r.value / max) * 100}%`, background: r.color, animationDelay: `${i * 45}ms` }}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
