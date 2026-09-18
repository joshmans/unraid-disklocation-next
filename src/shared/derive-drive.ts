import type { DiskResult } from "../graphql/queries.js";
import type { BayDrive, DriveStatus, DriveType } from "./chassis-types.js";

/**
 * `interfaceType: "PCIE"` reliably means NVMe. Beyond that, the 2026-09
 * schema verification (see ROADMAP.md) didn't pin down what values
 * `disks.type` actually returns for SATA/SAS drives, so SSD vs spinning HDD
 * is a best-effort substring match on that field, defaulting to "hdd" - only
 * affects which icon/legend entry is shown, never correctness of the
 * assignment itself. Revisit against a live box if this turns out wrong.
 */
function inferDriveType(disk: DiskResult): DriveType {
  if (disk.interfaceType === "PCIE") return "nvme";
  return /ssd/i.test(disk.type) ? "ssd" : "hdd";
}

const STATUS_RANK: Record<DriveStatus, number> = { ok: 0, warn: 1, critical: 2 };

/** Never let a favorable reading from one source mask a bad one from the other. */
function worseStatus(a: DriveStatus, b: DriveStatus): DriveStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * `historyStatus` is this plugin's own smartctl-derived assessment from
 * smart-history.ts - the only way "critical" is ever reachable from live
 * data, since unraid-api's smartStatus is OK/UNKNOWN only (see ROADMAP.md).
 * Absent (no poll sample yet for this disk) is treated as "ok" so it never
 * suppresses a real smartStatus-based warning.
 */
export function driveFromDisk(disk: DiskResult, historyStatus?: DriveStatus): BayDrive {
  const smartStatusBased = disk.smartStatus === "OK" ? "ok" : "warn";
  return {
    driveType: inferDriveType(disk),
    status: worseStatus(smartStatusBased, historyStatus ?? "ok"),
    label: disk.serialNum || disk.name,
  };
}
