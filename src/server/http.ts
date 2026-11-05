import "server-only";
import { env } from "@/env";

/** CSRF defence for custom POST route handlers (server actions already check origin). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return origin === new URL(env.APP_URL).origin || origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

/** Native apps authenticate with `Authorization: Bearer <token>` and are not exposed to CSRF. */
export const hasBearer = (req: Request) => /^Bearer\s+\S+/i.test(req.headers.get("authorization") ?? "");

/** CSRF check for writes: bearer-token clients, or cookie clients on our own origin. */
export const csrfOk = (req: Request) => hasBearer(req) || sameOrigin(req);
