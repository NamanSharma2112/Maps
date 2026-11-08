export type ScaleType = "quantile" | "linear";

export interface ColorScale {
  /** CSS colors, lightest → darkest. */
  colors: string[];
  /** Upper bound of each bin except the last (length = colors.length - 1). */
  thresholds: number[];
  min: number;
  max: number;
  colorOf: (value: number | undefined) => string | undefined;
}

/** Sequential ramp: the accent mixed into the empty-land tone, 25% → 100%. */
export function defaultRamp(steps: number): string[] {
  return Array.from({ length: steps }, (_, i) => {
    const pct = Math.round(22 + (78 * i) / Math.max(1, steps - 1));
    return `color-mix(in oklab, var(--mr-accent) ${pct}%, var(--mr-land))`;
  });
}

export function createColorScale(values: number[], { steps = 5, type = "quantile", colors }: { steps?: number; type?: ScaleType; colors?: string[] } = {}): ColorScale {
  const ramp = colors?.length ? colors : defaultRamp(steps);
  const n = ramp.length;
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const thresholds: number[] = [];
  for (let i = 1; i < n; i++) {
    if (type === "linear") thresholds.push(min + ((max - min) * i) / n);
    else {
      const pos = (sorted.length - 1) * (i / n);
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      thresholds.push(sorted.length ? sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo) : 0);
    }
  }
  return {
    colors: ramp,
    thresholds,
    min,
    max,
    colorOf(value) {
      if (value === undefined || !Number.isFinite(value)) return undefined;
      let i = 0;
      while (i < thresholds.length && value > thresholds[i]) i++;
      return ramp[i];
    },
  };
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (v: number) => compact.format(v);
export const formatNumber = (v: number) => v.toLocaleString("en");
