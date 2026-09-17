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

export interface StoredLayout {
  layout: ChassisLayout;
  logos: LogoConfig;
}
