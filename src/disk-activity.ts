import { readFileSync } from "node:fs";

const BARE_DEVICE_PATTERN = /^[a-zA-Z0-9]+$/;

// /sys/block/<dev>/stat field order (Linux kernel's
// Documentation/ABI/testing/sysfs-block): field 1 (index 0) is reads
// completed, field 5 (index 4) is writes completed - enough to detect "did
// this device finish any I/O since we last looked," which is exactly what a
// physical hot-swap bay's own activity LED reflects. Not interested in the
// throughput/latency fields also present.
function readIoCounters(device: string): [reads: number, writes: number] | null {
  try {
    const raw = readFileSync(`/sys/block/${device}/stat`, "utf8");
    const fields = raw.trim().split(/\s+/).map(Number);
    return [fields[0] ?? 0, fields[4] ?? 0];
  } catch {
    return null; // removed drive, partition-only node, not a real block device, etc.
  }
}

const lastSample = new Map<string, [number, number]>();

/**
 * True if `rawDevice` completed any read/write I/O since the last call made
 * for that same device. The first-ever observation of a device has nothing
 * to diff against yet, so it always reports false rather than guessing.
 */
export function sampleActivity(rawDevice: string): boolean {
  const device = rawDevice.replace(/^\/dev\//, "");
  if (!BARE_DEVICE_PATTERN.test(device)) return false;
  const current = readIoCounters(device);
  if (!current) return false;
  const previous = lastSample.get(device);
  lastSample.set(device, current);
  if (!previous) return false;
  return current[0] !== previous[0] || current[1] !== previous[1];
}
