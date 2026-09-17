// Frontend-side chassis helpers. The types themselves live in
// src/shared/chassis-types.ts so the backend (which persists this as the
// plugin's own config, per ROADMAP.md) and the frontend agree on the shape.
export type {
  Orientation,
  DriveType,
  DriveStatus,
  BayDrive,
  BayConfig,
  BayGroup,
  PcieCardConfig,
  PcieGroup,
  Group,
  ChassisLayout,
  LogoConfig,
  StoredLayout,
} from "../../shared/chassis-types.js";

import type { BayConfig, BayDrive, ChassisLayout } from "../../shared/chassis-types.js";

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
 * Demo layout shown until the user saves their own via the settings UI:
 * a 24-bay 4U front chassis (SuperMicro-skinned 3.5" bays), a 4-bay 2.5"
 * rear cage (HP-skinned, vertical), and a rear x16 NVMe carrier - proves
 * TrayMap can render bay groups and PCIe-carrier groups side by side.
 */
export const exampleLayout: ChassisLayout = {
  id: "example-4u-24bay",
  name: 'Example: 24-bay 4U + rear 2.5" cage + PCIe carrier',
  groups: [
    { kind: "bays", id: "front", label: 'Front (3.5" hot-swap)', rows: 4, columns: 6, bays: frontBays() },
    { kind: "bays", id: "rear", label: 'Rear (2.5" cage)', rows: 1, columns: 4, bays: rearBays() },
    {
      kind: "pcie",
      id: "pcie",
      label: "Add-in cards",
      cards: [{ id: "slot3", carrierId: "default", label: "Slot 3 - x16 NVMe carrier", moduleCount: 4 }],
    },
  ],
};

/** Sample occupancy for the example layout - stands in for live disk data merged onto bays/modules by their assigned id. */
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
  "slot3-m0": { driveType: "nvme", status: "ok", label: "SN NVME-A1" },
  "slot3-m1": { driveType: "nvme", status: "ok", label: "SN NVME-A2" },
  "slot3-m2": { driveType: "nvme", status: "warn", label: "SN NVME-A3" },
};

/** Manufacturer logo URL per tray-skin id, applied to every bay using that skin. Empty until the settings UI is used. */
export const exampleLogos: Record<string, string> = {};
