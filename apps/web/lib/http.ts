import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * fetch with a timeout, JSON parsing and zod validation of the response.
 * Every external call in lib/ goes through this so responses are typed and
 * no call can hang the app.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15_000, ...rest } = init;
  const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`${rest.method ?? "GET"} ${url} → ${res.status}`, res.status, text);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(`${url} returned non-JSON`, res.status, text.slice(0, 500));
  }
  return schema.parse(data);
}
