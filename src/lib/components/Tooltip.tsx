import type { ReactNode } from "react";

export interface TooltipProps {
  x: number;
  y: number;
  title: ReactNode;
  children?: ReactNode;
  /** Small colored square before the title. */
  swatch?: string;
}

/** Floating label positioned above a point inside a `position: relative` parent. */
export function Tooltip({ x, y, title, children, swatch }: TooltipProps) {
  return (
    <div className="mr-tooltip" role="tooltip" style={{ left: x, top: y }}>
      <div className="mr-tooltip__title">
        {swatch && <span className="mr-tooltip__swatch" style={{ background: swatch }} />}
        {title}
      </div>
      {children ? <div className="mr-tooltip__body">{children}</div> : null}
    </div>
  );
}
