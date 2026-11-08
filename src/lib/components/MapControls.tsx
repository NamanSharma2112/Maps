import { cx } from "../utils/cx";

export interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  className?: string;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Zoom in / zoom out / reset buttons. Rendered automatically by zoomable maps. */
export function MapControls({ onZoomIn, onZoomOut, onReset, canZoomIn = true, canZoomOut = true, className }: MapControlsProps) {
  return (
    <div className={cx("mr-root mr-controls", className)} role="group" aria-label="Map zoom">
      <button type="button" className="mr-controls__btn" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in" title="Zoom in">
        <Icon d="M8 3.5v9M3.5 8h9" />
      </button>
      <button type="button" className="mr-controls__btn" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out" title="Zoom out">
        <Icon d="M3.5 8h9" />
      </button>
      <button type="button" className="mr-controls__btn" onClick={onReset} disabled={!canZoomOut} aria-label="Reset view" title="Reset view">
        <Icon d="M2.75 8a5.25 5.25 0 1 0 1.54-3.71M2.75 2.75v2.5h2.5" />
      </button>
    </div>
  );
}
