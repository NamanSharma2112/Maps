import type { CSSProperties } from "react";
import { cx } from "../utils/cx";

export interface MapSkeletonProps {
  /** "globe" draws a circle, "map" a rounded frame. Default "map". */
  shape?: "globe" | "map";
  /** Width / height for the map shape. Default 2. */
  aspect?: number;
  /** Accessible label read while loading. Default "Loading map". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Shimmering placeholder shown while a map or globe loads. Matches the components' size and theme. */
export function MapSkeleton({ shape = "map", aspect = 2, label = "Loading map", className, style }: MapSkeletonProps) {
  return (
    <div
      className={cx("mr-root mr-skeleton", `mr-skeleton--${shape}`, className)}
      style={{ aspectRatio: shape === "globe" ? "1" : String(aspect), ...style }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="mr-skeleton__surface" />
    </div>
  );
}
