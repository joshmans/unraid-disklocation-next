// Chassis layout: the physical arrangement of drive bays a chassis has -
// which groups of bays it has (e.g. a front 3.5" hot-swap cage and a rear
// 2.5" cage are two separate physical groups, not one grid), and per-bay
// which tray skin and orientation to render. unraid-api has no concept of
// physical bay position (see ROADMAP.md's GraphQL-schema findings), so this
// mapping is entirely this plugin's own stored config. A settings UI to
// build one of these interactively is still an open item (ROADMAP.md); this
// module is the data shape that UI will read/write, with an example layout
// standing in for it until then.

export type Orientation = "horizontal" | "vertical";
export type DriveType = "hdd" | "ssd" | "nvme";
export type DriveStatus = "ok" | "warn" | "critical";

export interface BayConfig {
  /** Stable identifier, unique across the whole layout (not just its group) - used to key live drive data onto a bay. */
  id: string;
  /** Row/column position within this bay's own group, both 0-based. */
  row: number;
  col: number;
  /** Which assets/tray-skins/<skinId> to render this bay with. */
  skinId: string;
  orientation: Orientation;
}

export interface BayGroup {
  id: string;
  /** Shown as a heading above the group, e.g. "Front (3.5" hot-swap)". */
  label: string;
  rows: number;
  columns: number;
  bays: BayConfig[];
}

export interface ChassisLayout {
  id: string;
  name: string;
  groups: BayGroup[];
}

/** What TrayMap renders onto an occupied bay; a bay with no entry here renders as empty. */
export interface BayDrive {
  driveType: DriveType;
  status: DriveStatus;
  label: string;
  logoUrl?: string | null;
}

function frontBays(): BayConfig[] {
  const bays: BayConfig[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      bays.push({ id: `front-${row}-${col}`, row, col, skinId: "supermicro", orientation: "horizontal" });
    }
  }
  return bays;
}

function rearBays(): BayConfig[] {
  const bays: BayConfig[] = [];
  for (let col = 0; col < 4; col++) {
    bays.push({ id: `rear-${col}`, row: 0, col, skinId: "hp", orientation: "vertical" });
  }
  return bays;
}

/**
 * Stands in for a settings-UI-authored layout: a 24-bay 4U front chassis
 * (4 rows x 6 columns, SuperMicro-skinned 3.5" bays) plus a 4-bay 2.5" rear
 * cage (HP-skinned, vertical) - proves TrayMap can render more than one
 * bay group, with different skins and orientations, in a single layout.
 */
export const exampleLayout: ChassisLayout = {
  id: "example-4u-24bay",
  name: 'Example: 24-bay 4U + rear 2.5" cage',
  groups: [
    { id: "front", label: 'Front (3.5" hot-swap)', rows: 4, columns: 6, bays: frontBays() },
    { id: "rear", label: 'Rear (2.5" cage)', rows: 1, columns: 4, bays: rearBays() },
  ],
};

/** Sample occupancy for the example layout - stands in for live disk data merged onto bays by their assigned id. */
export const exampleDrives: Record<string, BayDrive> = {
  "front-0-0": { driveType: "hdd", status: "ok", label: "SN Z1E0A2B4" },
  "front-0-1": { driveType: "hdd", status: "ok", label: "SN Z1E0A2B5" },
  "front-0-2": { driveType: "hdd", status: "ok", label: "SN Z1E0A2B6" },
  "front-0-3": { driveType: "hdd", status: "warn", label: "SN Z1E0A2B7" },
  "front-0-4": { driveType: "hdd", status: "ok", label: "SN Z1E0A2B8" },
  "front-1-0": { driveType: "hdd", status: "ok", label: "SN Z1E0A2C0" },
  "front-1-1": { driveType: "hdd", status: "ok", label: "SN Z1E0A2C1" },
  "front-1-2": { driveType: "hdd", status: "critical", label: "SN Z1E0A2C2" },
  "front-1-3": { driveType: "hdd", status: "ok", label: "SN Z1E0A2C3" },
  "front-2-0": { driveType: "hdd", status: "ok", label: "SN Z1E0A2D0" },
  "front-2-1": { driveType: "hdd", status: "ok", label: "SN Z1E0A2D1" },
  "front-3-0": { driveType: "ssd", status: "ok", label: "SN CACHE-01" },
  "front-3-1": { driveType: "ssd", status: "ok", label: "SN CACHE-02" },
  "rear-0": { driveType: "ssd", status: "ok", label: "SN R-SSD01" },
  "rear-1": { driveType: "nvme", status: "ok", label: "SN R-NVM02" },
};
