// Chassis layout types, shared between the backend (persists this as the
// plugin's own config - unraid-api has no concept of physical bay position,
// see ROADMAP.md) and the frontend (renders it and lets the user edit it).
// No DOM/Node dependency here so both sides can import it as-is.

export type Orientation = "horizontal" | "vertical";
export type DriveType = "hdd" | "ssd" | "nvme";
export type DriveStatus = "ok" | "warn" | "critical";

/** What a bay or PCIe module slot renders when occupied; absent = empty. */
export interface BayDrive {
  driveType: DriveType;
  status: DriveStatus;
  label: string;
}

export interface BayConfig {
  /** Stable id, unique across the whole layout - used to key live drive data onto a bay. */
  id: string;
  row: number;
  col: number;
  /** Which assets/tray-skins/<skinId> to render this bay with. */
  skinId: string;
  orientation: Orientation;
}

export interface BayGroup {
  kind: "bays";
  id: string;
  /** Shown as a heading above the group, e.g. "Front (3.5" hot-swap)". */
  label: string;
  rows: number;
  columns: number;
  bays: BayConfig[];
}

export interface PcieCardConfig {
  /** Stable id, unique across the whole layout. Module drive data is keyed as `${id}-m${index}`. */
  id: string;
  /** Which assets/pcie-carrier/<carrierId>.svg shell to render. */
  carrierId: string;
  /** e.g. "Slot 3 - x16" */
  label: string;
  moduleCount: number;
}

export interface PcieGroup {
  kind: "pcie";
  id: string;
  label: string;
  cards: PcieCardConfig[];
}

export type Group = BayGroup | PcieGroup;

export interface ChassisLayout {
  id: string;
  name: string;
  groups: Group[];
}

/** Hotlinked manufacturer logo URL per tray-skin id - kept separate from the skins themselves so a skin PR never needs to carry a logo (see assets/tray-skins/README.md). */
export type LogoConfig = Record<string, string>;

/** Which physical disk (by serial number, stable across reboots/device renumbering) occupies which bay/module id. */
export type Assignments = Record<string, string>;

/**
 * Per-skin status-LED color overrides, keyed by skin id then status. Each
 * skin's meta.json declares its own defaults (real trays don't agree on one
 * green/amber/red convention - some blink blue, some split activity/fault
 * across two LEDs); this only holds the user's explicit overrides on top of
 * those defaults, so an unset entry here just means "use the skin's own".
 */
export type LedColorConfig = Record<string, Partial<Record<DriveStatus, string>>>;

export interface StoredLayout {
  layout: ChassisLayout;
  logos: LogoConfig;
  /** Optional for backward compatibility with layout.json files saved before assignment existed. */
  assignments?: Assignments;
  /** Optional for backward compatibility with layout.json files saved before LED color overrides existed. */
  ledColors?: LedColorConfig;
}
