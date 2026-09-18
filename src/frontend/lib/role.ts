import type { DriveRole } from "./chassis";

/**
 * Distinct from status colors (ok/warn/critical, see status.ts) - a role
 * color/badge is about what slot a disk occupies, not its health.
 * "unassigned" is intentionally colorless by default (transparent - no
 * ring, no tinted badge fill) since it's not really a "role" so much as the
 * absence of one; roleBadgeBackground() gives its badge a neutral, always-
 * visible fill without treating that as an actual role color.
 */
export const ROLE_COLORS: Record<DriveRole, string> = {
  parity: "#c9a227",
  data: "#4a9d5f",
  cache: "#5b7fd6",
  boot: "#9b9a94",
  unassigned: "transparent",
};

export const ROLE_BADGE_LETTER: Record<DriveRole, string> = {
  parity: "P",
  data: "D",
  cache: "C",
  boot: "B",
  unassigned: "U",
};

/** The badge always needs to be visible even when a role has no configured color (unassigned) - a plain neutral fill rather than ROLE_COLORS' "transparent". */
export function roleBadgeBackground(role: DriveRole): string {
  return role === "unassigned" ? "rgba(155, 154, 148, 0.55)" : ROLE_COLORS[role];
}

export function roleLabel(role: DriveRole | undefined, poolName?: string): string {
  if (!role || role === "unassigned") return "Unassigned";
  if (role === "cache") return poolName ? `Cache (${poolName})` : "Cache";
  return role[0].toUpperCase() + role.slice(1);
}

/** Binary units (Unraid's own convention - disks.ini/the array resolver both use KiB internally), one decimal place, no trailing zero clutter for whole numbers. */
export function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[i]}`;
}
