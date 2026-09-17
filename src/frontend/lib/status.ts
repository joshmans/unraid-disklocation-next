import type { DriveStatus, LedColorConfig } from "./chassis";
import type { Skin } from "./trayskins";

export const DEFAULT_LED_COLORS: Record<DriveStatus, string> = {
  ok: "#4a9d5f",
  warn: "#d9a72e",
  critical: "#c9463c",
};

export function statusColor(status: DriveStatus): string {
  return DEFAULT_LED_COLORS[status];
}

/** User override (if any) > the skin's own default (if any) > the global default. */
export function resolveLedColor(skin: Skin, overrides: LedColorConfig, status: DriveStatus): string {
  return overrides[skin.id]?.[status] ?? skin.ledColors?.[status] ?? DEFAULT_LED_COLORS[status];
}
