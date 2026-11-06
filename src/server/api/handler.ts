import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { API_VERSION, CLIENT_HEADER, compareVersions } from "@/lib/api/routes";
import { env } from "@/env";
import { auth } from "../auth";
import { isLockedOut, loadCtx } from "../context";
import { LOCKED_MESSAGE } from "../services/subscription";
import { connectDb } from "../db";
import { csrfOk } from "../http";
import { toSafeError, type ActionResult, type ErrorCode } from "../with-auth";
import { match, ROUTES, type Req } from "./routes";

const MAX_BODY = 6 * 1024 * 1024; // same limit as server actions
const STATUS: Record<ErrorCode, number> = { UNAUTHENTICATED: 401, LOCKED: 402, FORBIDDEN: 403, NOT_FOUND: 404, INVALID: 422, CONFLICT: 409, INSUFFICIENT_STOCK: 409, CREDIT_LIMIT: 409, UPGRADE_REQUIRED: 426, NO_BUSINESS: 403, INTERNAL: 500 };
const SESSION_COOKIES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

type Fail = Extract<ActionResult<unknown>, { ok: false }>;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, code: ErrorCode, error: string) => json({ ok: false, code, error }, status);

/** Actions that predate error codes (auth flows) still get a sensible HTTP status. */
function statusOf(r: Fail) {
  if (r.code) return STATUS[r.code];
  if (/session has expired/i.test(r.error)) return 401;
  if (r.error === "UNVERIFIED") return 403;
  if (/^too many/i.test(r.error)) return 429;
  return 400;
}

async function readBody(req: Request): Promise<{ body: Record<string, unknown>; form: FormData | null } | NextResponse> {
  if (req.method === "GET" || req.method === "HEAD") return { body: {}, form: null };
  const type = req.headers.get("content-type") ?? "";
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail(413, "INVALID", "Request is too large.");
  if (type.startsWith("multipart/form-data")) return { body: {}, form: await req.formData() };
  const text = await req.text();
  if (text.length > MAX_BODY) return fail(413, "INVALID", "Request is too large.");
  if (!text) return { body: {}, form: null };
  if (!type.includes("application/json")) return fail(415, "INVALID", "Send JSON with Content-Type: application/json.");
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(422, "INVALID", "The request body must be a JSON object.");
    return { body: parsed as Record<string, unknown>, form: null };
  } catch {
    return fail(400, "INVALID", "The request body is not valid JSON.");
  }
}

/** The session token that sign-in just set, for clients that send it as a Bearer token. */
async function sessionToken() {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const v = jar.get(name)?.value;
    if (v) return v;
  }
  return null;
}

// Per-client request cap for the REST API (Better Auth already throttles sign-in; the auth routes have their own limits).
// ponytail: in-memory per server instance, which is exact while the service runs one replica; move to the
// RateLimit collection if you scale out to several replicas.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 600;
const hits = new Map<string, { n: number; reset: number }>();
function overLimit(req: Request) {
  const now = Date.now();
  const auth = req.headers.get("authorization");
  const key = auth ? `t:${auth.slice(-24)}` : `ip:${req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "local"}`;
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > MAX_PER_WINDOW;
}

/** Oldest app version each platform may use (operators raise these to retire old builds). */
const minVersions = () => ({ android: env.MIN_ANDROID_VERSION ?? null, ios: env.MIN_IOS_VERSION ?? null, desktop: env.MIN_DESKTOP_VERSION ?? null });

/** "android/1.4.0" → too old? Browsers and unknown clients send nothing and are never blocked. */
function outdated(req: Request) {
  const m = /^(android|ios|desktop)\/(\d+\.\d+\.\d+)/i.exec(req.headers.get(CLIENT_HEADER) ?? "");
  if (!m) return null;
  const min = minVersions()[m[1].toLowerCase() as "android" | "ios" | "desktop"];
  return min && compareVersions(m[2], min) < 0 ? min : null;
}

export async function handleApi(req: Request, segments: string[] = []) {
  const path = "/" + segments.join("/");
  if (req.method === "GET" && path === "/") {
    return json({
      ok: true,
      data: {
        name: "Galla API",
        version: API_VERSION,
        minClientVersions: minVersions(),
        auth: "Cookie session or Authorization: Bearer <token> from POST /api/v1/auth/sign-in",
        routes: ROUTES.map((r) => ({ name: r.name, method: r.method, path: `/api/v1${r.path}`, summary: r.summary, ...(r.query ? { query: r.query } : {}) })),
      },
    });
  }
  if (overLimit(req)) return fail(429, "INVALID", "Too many requests. Please slow down and try again in a minute.");
  const tooOld = outdated(req);
  if (tooOld) return json({ ok: false, code: "UPGRADE_REQUIRED", error: `This version of the app is no longer supported. Update Galla to ${tooOld} or newer.`, minVersion: tooOld }, 426);
  const m = match(req.method, path);
  if (!m) return fail(404, "NOT_FOUND", `No endpoint ${req.method} /api/v1${path}`);
  // Sign-in style routes carry no session yet, so there is nothing to forge; everything else needs a bearer token or our origin.
  if (req.method !== "GET" && !(m.route.kind === "action" && m.route.public) && !csrfOk(req)) return fail(403, "FORBIDDEN", "Cross-site request refused.");

  const parsed = await readBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const url = new URL(req.url);
  const r: Req = { params: m.params, query: Object.fromEntries(url.searchParams), body: parsed.body, form: parsed.form };

  try {
    if (m.route.kind === "query") {
      const ctx = await loadCtx();
      if (!ctx) {
        if (await isLockedOut()) return fail(402, "LOCKED", LOCKED_MESSAGE);
        // Signed in, but not a member of any business (accounts are created in the provider portal).
        const session = await auth.api.getSession({ headers: await headers() });
        return session ? fail(403, "NO_BUSINESS", "Your account isn't linked to a store yet. Contact Concilio Solutions.") : fail(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
      }
      await connectDb();
      return json({ ok: true, data: await m.route.run(ctx, r) });
    }
    const result = await m.route.run(r, m.route);
    if (!result.ok) return json(result, statusOf(result));
    // Sign-in style routes: hand native apps the session token they must send back as Bearer
    // (also when the action itself returns no data, e.g. finishing a two-step sign-in).
    if (m.route.public) {
      const token = await sessionToken();
      if (token) return json({ ok: true, data: { ...(result.data && typeof result.data === "object" ? result.data : {}), token } });
    }
    return json(result);
  } catch (err) {
    const e = toSafeError(err);
    return json({ ok: false, ...e }, STATUS[e.code]);
  }
}
