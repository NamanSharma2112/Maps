/** A geographic position in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker extends LatLng {
  id?: string;
  /** Text shown next to the marker and in its tooltip. */
  label?: string;
  /** Any CSS color. Defaults to the theme accent. */
  color?: string;
  /** Dot radius in px. Default 3.5. */
  size?: number;
  /** Animated pulse ring. Default true. */
  pulse?: boolean;
  /** Where the label sits relative to the dot on flat maps. Default "right". */
  labelPosition?: "right" | "left" | "top" | "bottom";
  /** Extra line in the tooltip. */
  description?: string;
}

export interface MapArc {
  id?: string;
  from: LatLng;
  to: LatLng;
  /** Any CSS color. Defaults to the theme arc color. */
  color?: string;
  /** Seconds before this arc starts animating. Defaults to a stagger by index. */
  delay?: number;
}

export type MapVariant = "dots" | "solid" | "outline";

/** A proportional symbol: circle area (or spike height) scales with `value`. */
export interface MapBubble extends LatLng {
  value: number;
  label?: string;
  /** Any CSS color. Defaults to the theme accent. */
  color?: string;
}
