import type { Settings } from "../config.js";

// Thin wrapper only - the actual queries (array/disk/SMART shape) still need
// to be written against a live Unraid 7.2+ instance's schema. Nothing here
// has been run against real unraid-api yet.
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
