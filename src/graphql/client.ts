import type { Settings } from "../config.js";
import { ARRAY_QUERY, DISKS_QUERY, type ArrayResult, type DiskResult } from "./queries.js";

export async function queryUnraidApi<T>(
  settings: Settings,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(settings.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`unraid-api request failed: ${res.status} ${res.statusText}`);
  }

  const { data, errors } = (await res.json()) as { data?: T; errors?: unknown[] };
  if (errors?.length) {
    throw new Error(`unraid-api returned errors: ${JSON.stringify(errors)}`);
  }
  return data as T;
}

export async function getDisks(settings: Settings): Promise<DiskResult[]> {
  const { disks } = await queryUnraidApi<{ disks: DiskResult[] }>(settings, DISKS_QUERY);
  return disks;
}

export async function getArray(settings: Settings): Promise<ArrayResult> {
  const { array } = await queryUnraidApi<{ array: ArrayResult }>(settings, ARRAY_QUERY);
  return array;
}
