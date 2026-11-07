import "server-only";
import { unstable_rethrow } from "next/navigation";
import mongoose from "mongoose";
import { z } from "zod";
import { can, type Permission } from "@/lib/permissions";
import { AppError, isLockedOut, loadCtx, type Ctx } from "./context";
import { LOCKED_MESSAGE } from "./services/subscription";
import { connectDb } from "./db";

export type ErrorCode = "UNAUTHENTICATED" | "LOCKED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT" | "INSUFFICIENT_STOCK" | "CREDIT_LIMIT" | "UPGRADE_REQUIRED" | "NO_BUSINESS" | "INTERNAL";
/** `code` is machine-readable (the REST API maps it to an HTTP status); the web UI shows `error`. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: ErrorCode; fieldErrors?: Record<string, string[]> };

/**
 * Every server action goes through here: session → active business → role permission →
 * strict input validation → handler. Errors are mapped to safe messages.
 */
export function withAuth<S extends z.ZodType, T>(permission: Permission, schema: S, fn: (ctx: Ctx, input: z.output<S>) => Promise<T>) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const ctx = await loadCtx();
      if (!ctx) {
        if (await isLockedOut()) return { ok: false, code: "LOCKED", error: LOCKED_MESSAGE };
        return { ok: false, code: "UNAUTHENTICATED", error: "Your session has expired. Please sign in again." };
      }
      if (!can(ctx.role, permission)) return { ok: false, code: "FORBIDDEN", error: "You don't have permission to do that." };
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".") || "_";
          (fieldErrors[key] ??= []).push(issue.message);
        }
        return { ok: false, code: "INVALID", error: "Please fix the highlighted fields.", fieldErrors };
      }
      await connectDb();
      return { ok: true, data: await fn(ctx, parsed.data) };
    } catch (err) {
      unstable_rethrow(err);
      return { ok: false, ...toSafeError(err) };
    }
  };
}

export function toSafeError(err: unknown): { error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> } {
  if (err instanceof AppError) return { error: err.message, code: err.code, fieldErrors: err.fieldErrors };
  if (err instanceof mongoose.Error.ValidationError) {
    return { code: "INVALID", error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]])) };
  }
  if ((err as { code?: number })?.code === 11000) {
    const key = Object.keys((err as { keyPattern?: object }).keyPattern ?? {}).filter((k) => k !== "orgId").join(", ");
    return { code: "CONFLICT", error: `That ${key.replace("variants.", "") || "value"} is already in use.` };
  }
  console.error("[action] unexpected error", err);
  return { code: "INTERNAL", error: "Something went wrong. Please try again." };
}

/** Runs fn inside a Mongo transaction with automatic retry on transient errors. */
export async function inTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  await connectDb();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
export const money = z.number().int().min(0).max(1e13);
