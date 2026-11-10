/**
 * Point-in-shape lookups by rasterising: every shape is filled once into an offscreen canvas in its
 * own colour, then each query is a single pixel read. Edge pixels, where antialiasing blends
 * colours, fall back to native point-in-path on the shapes whose bounds contain the point.
 */
export interface RasterIndex {
  /** Index of the shape under (x, y), or -1. */
  at(x: number, y: number): number;
}

export function canRasterise(): boolean {
  return typeof document !== "undefined" && typeof Path2D !== "undefined";
}

export function rasterIndex(
  width: number,
  height: number,
  paths: (string | null)[],
  /** Screen-space bounds per shape, so edge pixels only test shapes that could contain them. */
  bounds: ([[number, number], [number, number]] | null)[],
): RasterIndex | null {
  if (!canRasterise() || width < 1 || height < 1) return null;
  const w = Math.ceil(width), h = Math.ceil(height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const shapes = paths.map((d) => (d ? new Path2D(d) : null));
  shapes.forEach((p, i) => {
    if (!p) return;
    const id = i + 1; // 0 = empty
    ctx.fillStyle = `rgb(${(id >> 16) & 255},${(id >> 8) & 255},${id & 255})`;
    ctx.fill(p);
  });
  const px = ctx.getImageData(0, 0, w, h).data;
  const read = (x: number, y: number) => {
    const o = (y * w + x) * 4;
    return px[o + 3] === 255 ? ((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]) - 1 : -2; // -2 = partly covered
  };
  return {
    at(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return -1;
      const v = read(ix, iy);
      // a clean pixel whose neighbours agree is trusted; anything else gets the exact test
      if (v >= -1 && v < shapes.length && (ix === 0 || read(ix - 1, iy) === v) && (ix === w - 1 || read(ix + 1, iy) === v) &&
          (iy === 0 || read(ix, iy - 1) === v) && (iy === h - 1 || read(ix, iy + 1) === v)) return v;
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i], b = bounds[i];
        if (!s || !b || x < b[0][0] || x > b[1][0] || y < b[0][1] || y > b[1][1]) continue;
        if (ctx.isPointInPath(s, x, y)) return i;
      }
      return -1;
    },
  };
}
