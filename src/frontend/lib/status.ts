import type { DriveStatus } from "./chassis";

export function statusColor(status: DriveStatus): string {
  return status === "ok" ? "#4a9d5f" : status === "warn" ? "#d9a72e" : "#c9463c";
}
