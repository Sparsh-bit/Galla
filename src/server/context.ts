import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, isRole, type Permission, type Role } from "@/lib/permissions";
import { auth } from "./auth";
import { connectDb } from "./db";
import { OrgSettings, Types, type OrgSettingsDoc } from "./models";

export interface Ctx {
  userId: string;
  userName: string;
  userEmail: string;
  orgId: string;
  orgName: string;
  role: Role;
  ip?: string;
  ua?: string;
  /** Every business this user belongs to (for the business switcher). */
  orgs?: { id: string; name: string }[];
}

export class AppError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT" | "INSUFFICIENT_STOCK" | "CREDIT_LIMIT" | "UNAUTHENTICATED",
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** Resolves the signed-in user + active business, or null. Memoized per request. */
export const loadCtx = cache(async (): Promise<Ctx | null> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const { connection } = await connectDb();
  const db = connection.db!;
  const userId = new Types.ObjectId(session.user.id);
  const active = session.session.activeOrganizationId;
  // One round trip: all of the user's businesses with their names. The active one wins, otherwise the
  // oldest (e.g. after being removed from the active one). Each extra query costs a full network hop to Atlas.
  const memberships = await db
    .collection("member")
    .aggregate<{ role: unknown; organizationId: Types.ObjectId; name?: string }>([
      { $match: { userId } },
      { $sort: { createdAt: 1 } },
      { $lookup: { from: "organization", localField: "organizationId", foreignField: "_id", as: "org", pipeline: [{ $project: { name: 1 } }] } },
      { $unwind: "$org" },
      { $project: { role: 1, organizationId: 1, name: "$org.name" } },
    ])
    .toArray();
  const member = memberships.find((m) => active && String(m.organizationId) === active) ?? memberships[0];
  if (!member || !isRole(member.role)) return null;
  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    orgId: String(member.organizationId),
    orgName: String(member.name),
    role: member.role,
    ip: h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? undefined,
    ua: h.get("user-agent") ?? undefined,
    orgs: memberships.map((m) => ({ id: String(m.organizationId), name: String(m.name) })),
  };
});

/** For pages: redirects to sign-in / onboarding, 403s on missing permission. */
export async function requireCtx(permission?: Permission): Promise<Ctx> {
  const ctx = await loadCtx();
  if (!ctx) {
    const session = await auth.api.getSession({ headers: await headers() });
    redirect(session ? "/onboarding" : "/sign-in");
  }
  if (permission && !can(ctx.role, permission)) redirect("/forbidden");
  return ctx;
}

export const getOrgSettings = cache(async (orgId: string): Promise<OrgSettingsDoc> => {
  await connectDb();
  const s = await OrgSettings.findOne({ orgId }).lean<OrgSettingsDoc>();
  if (!s) throw new AppError("NOT_FOUND", "Business settings missing");
  return s;
});
