import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, isRole, type Permission, type Role } from "@/lib/permissions";
import { auth } from "./auth";
import { connectDb } from "./db";
import { OrgSettings, ProviderAdmin, Types, type OrgSettingsDoc } from "./models";
import { lockReason } from "./services/subscription";

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
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT" | "INSUFFICIENT_STOCK" | "CREDIT_LIMIT" | "UNAUTHENTICATED" | "LOCKED",
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

type Access = { ctx: Ctx | null; signedIn: boolean; locked: boolean };

/**
 * The signed-in user, their usable businesses and the active one, in one database round trip
 * (memberships + business names + subscription). Businesses that are locked or past their paid date
 * are left out; if that leaves none, `locked` is true. Memoized per request.
 */
const loadAccess = cache(async (): Promise<Access> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return { ctx: null, signedIn: false, locked: false };
  const { connection } = await connectDb();
  const db = connection.db!;
  const userId = new Types.ObjectId(session.user.id);
  const active = session.session.activeOrganizationId;
  const all = await db
    .collection("member")
    .aggregate<{ role: unknown; organizationId: Types.ObjectId; name?: string; sub?: { status?: string; paidUntil?: Date | null } }>([
      { $match: { userId } },
      { $sort: { createdAt: 1 } },
      { $lookup: { from: "organization", localField: "organizationId", foreignField: "_id", as: "org", pipeline: [{ $project: { name: 1 } }] } },
      { $unwind: "$org" },
      { $lookup: { from: "subscriptions", localField: "organizationId", foreignField: "orgId", as: "sub", pipeline: [{ $project: { status: 1, paidUntil: 1 } }] } },
      { $project: { role: 1, organizationId: 1, name: "$org.name", sub: { $first: "$sub" } } },
    ])
    .toArray();
  const memberships = all.filter((m) => !lockReason(m.sub));
  const member = memberships.find((m) => active && String(m.organizationId) === active) ?? memberships[0];
  if (!member || !isRole(member.role)) return { ctx: null, signedIn: true, locked: all.length > 0 && memberships.length === 0 };
  return {
    signedIn: true,
    locked: false,
    ctx: {
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      orgId: String(member.organizationId),
      orgName: String(member.name),
      role: member.role,
      ip: h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? undefined,
      ua: h.get("user-agent") ?? undefined,
      orgs: memberships.map((m) => ({ id: String(m.organizationId), name: String(m.name) })),
    },
  };
});

/** Resolves the signed-in user + active business, or null. Memoized per request. */
export const loadCtx = cache(async (): Promise<Ctx | null> => (await loadAccess()).ctx);

/** True when the user is signed in but every business they belong to is locked or expired. */
export const isLockedOut = cache(async () => (await loadAccess()).locked);

/** For pages: redirects to sign-in / onboarding / the locked screen, 403s on missing permission. */
export async function requireCtx(permission?: Permission): Promise<Ctx> {
  const access = await loadAccess();
  const ctx = access.ctx;
  if (!ctx) {
    if (!access.signedIn) redirect("/sign-in");
    if (access.locked) redirect("/locked");
    const session = await auth.api.getSession({ headers: await headers() });
    if (session && (await ProviderAdmin.exists({ userId: session.user.id }))) redirect("/provider");
    redirect("/onboarding");
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
