import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { request as httpRequest } from "node:http";
import type { Settings } from "../config.js";
import { ARRAY_QUERY, DISKS_QUERY, type ArrayResult, type DiskResult } from "./queries.js";

// unraid-api's own GraphQL endpoint is served over HTTPS with Unraid's
// self-signed certificate, which never verifies against the system trust
// store. The rc.d script used to work around that by setting
// NODE_TLS_REJECT_UNAUTHORIZED=0 for the whole process, which also silently
// disabled certificate checking for anything else Node did (any host, not
// just this one request) - flagged by the CA security review that landed
// the loopback-binding fix in #4. Doing the POST by hand with node:https
// lets certificate checking be skipped only for this one request, and only
// when graphqlUrl actually points at loopback, which is the one case that
// needs it; a graphqlUrl pointed anywhere else still gets normal TLS
// verification.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const insecureLoopbackAgent = new HttpsAgent({ rejectUnauthorized: false });

function postJson(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; text: string }> {
  const target = new URL(url);
  const isHttps = target.protocol === "https:";
  const doRequest = isHttps ? httpsRequest : httpRequest;
  const payload = Buffer.from(body, "utf-8");

  const options: Record<string, unknown> = {
    method: "POST",
    headers: { ...headers, "Content-Length": payload.length },
  };
  if (isHttps && LOOPBACK_HOSTS.has(target.hostname)) {
    options.agent = insecureLoopbackAgent;
  }

  return new Promise((resolve, reject) => {
    const req = doRequest(target, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf-8") }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}

export async function queryUnraidApi<T>(
  settings: Settings,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await postJson(
    settings.graphqlUrl,
    {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
    },
    JSON.stringify({ query, variables }),
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`unraid-api request failed: ${res.status}`);
  }

  const { data, errors } = JSON.parse(res.text) as { data?: T; errors?: unknown[] };
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
