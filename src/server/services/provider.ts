import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { env } from "@/env";
import { auth } from "../auth";
import { AppError, type Ctx } from "../context";
import { connectDb } from "../db";
import { ProviderAdmin, ProviderAudit, Subscription, Types } from "../models";
import { initializeBusiness, slugify } from "./onboarding";
import { lockReason } from "./subscription";

// Provider portal (Concilio Solutions staff): every seller business, subscriptions, locks.
// Only users listed in ProviderAdmin get in; every change is written to ProviderAudit.

export interface ProviderUser { userId: string; email: string }

async function db() {
  return (await connectDb()).connection.db!;
}

/** The signed-in provider admin, or null. */
export async function loadProvider(): Promise<ProviderUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  await connectDb();
  const admin = await ProviderAdmin.findOne({ userId: session.user.id }).lean();
  return admin ? { userId: admin.userId, email: admin.email } : null;
}

export async function requireProvider(): Promise<ProviderUser> {
  const p = await loadProvider();
  if (!p) redirect("/provider/sign-in");
  return p;
}

async function hashPassword(pw: string) {
  return (await auth.$context).password.hash(pw);
}

/** Creates a verified email+password login (no business). Throws CONFLICT if the email is taken. */
async function createLogin(email: string, name: string, password: string) {
  const c = await auth.$context;
  if (await c.internalAdapter.findUserByEmail(email)) throw new AppError("CONFLICT", "An account with this email already exists.");
  const user = await c.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "admin" });
  await c.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await hashPassword(password) });
  return user;
}

/**
 * First-run bootstrap: creates the provider admin from PROVIDER_ADMIN_EMAIL / PROVIDER_ADMIN_PASSWORD
 * (server environment only) if that account doesn't exist yet. An existing account with the same email
 * is never promoted automatically.
 */
export async function ensureProviderAdmin() {
  const email = env.PROVIDER_ADMIN_EMAIL?.toLowerCase();
  const password = env.PROVIDER_ADMIN_PASSWORD;
  if (!email || !password) return;
  await connectDb();
  if (await ProviderAdmin.exists({ email })) return;
  const c = await auth.$context;
  if (await c.internalAdapter.findUserByEmail(email)) return;
  const user = await createLogin(email, "Concilio Solutions", password);
  await ProviderAdmin.create({ userId: user.id, email });
}

export const isProviderAdmin = async (userId: string) => !!(await ProviderAdmin.exists({ userId }));

export async function audit(p: ProviderUser, action: string, org: { id?: string; name?: string } | null, detail = "") {
  const h = await headers();
  await ProviderAudit.create({ adminEmail: p.email, action, orgId: org?.id, orgName: org?.name, detail, ip: h.get("x-forwarded-for")?.split(",").at(-1)?.trim() });
}

/* ---------------- reads ---------------- */

export async function listSellers(q = "") {
  const d = await db();
  const since = new Date(Date.now() - 30 * 86400e3);
  const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const [orgs, sales, products] = await Promise.all([
    d.collection("organization").aggregate<{ _id: Types.ObjectId; name: string; createdAt: Date; owner?: { email: string; name: string }; members: number; sub?: { plan?: string; priceMonthly?: number; paidUntil?: Date | null; status?: string; lockReason?: string } }>([
      { $lookup: { from: "member", localField: "_id", foreignField: "organizationId", as: "m" } },
      { $lookup: { from: "user", let: { owner: { $first: { $filter: { input: "$m", cond: { $eq: ["$$this.role", "owner"] } } } } }, pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$owner.userId"] } } }, { $project: { email: 1, name: 1 } }], as: "owner" } },
      { $lookup: { from: "subscriptions", localField: "_id", foreignField: "orgId", as: "sub" } },
      { $project: { name: 1, createdAt: 1, members: { $size: "$m" }, owner: { $first: "$owner" }, sub: { $first: "$sub" } } },
      { $sort: { createdAt: -1 } },
      { $limit: 2000 }, // ponytail: one page of 2000 businesses; add paging when you pass that
    ]).toArray(),
    d.collection("sales").aggregate<{ _id: Types.ObjectId; bills: number; revenue: number; last: Date }>([
      { $match: { status: "completed", completedAt: { $gte: since } } },
      { $group: { _id: "$orgId", bills: { $sum: 1 }, revenue: { $sum: "$grandTotal" }, last: { $max: "$completedAt" } } },
    ]).toArray(),
    d.collection("products").aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: "$orgId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const saleBy = new Map(sales.map((s) => [String(s._id), s]));
  const prodBy = new Map(products.map((p) => [String(p._id), p.n]));
  const rows = orgs
    .filter((o) => !rx || rx.test(o.name) || (o.owner?.email && rx.test(o.owner.email)))
    .map((o) => {
      const s = saleBy.get(String(o._id));
      return {
        id: String(o._id), name: o.name, createdAt: o.createdAt, ownerEmail: o.owner?.email ?? "", ownerName: o.owner?.name ?? "", members: o.members,
        plan: o.sub?.plan ?? "Standard", priceMonthly: o.sub?.priceMonthly ?? 0, paidUntil: o.sub?.paidUntil ?? null, state: lockReason(o.sub) ?? "active",
        products: prodBy.get(String(o._id)) ?? 0, bills30: s?.bills ?? 0, revenue30: s?.revenue ?? 0, lastSaleAt: s?.last ?? null,
      };
    });
  return rows;
}

export async function getSeller(orgId: string) {
  if (!/^[a-f0-9]{24}$/.test(orgId)) throw new AppError("NOT_FOUND", "Not found");
  const d = await db();
  const _id = new Types.ObjectId(orgId);
  const org = await d.collection("organization").findOne({ _id });
  if (!org) throw new AppError("NOT_FOUND", "Not found");
  const [members, sub, settings, counts] = await Promise.all([
    d.collection("member").aggregate<{ role: string; createdAt: Date; user?: { _id: Types.ObjectId; email: string; name: string } }>([
      { $match: { organizationId: _id } },
      { $lookup: { from: "user", localField: "userId", foreignField: "_id", as: "user", pipeline: [{ $project: { email: 1, name: 1 } }] } },
      { $project: { role: 1, createdAt: 1, user: { $first: "$user" } } },
    ]).toArray(),
    Subscription.findOne({ orgId: _id }).lean(),
    d.collection("orgsettings").findOne({ orgId: _id }, { projection: { phone: 1, email: 1, taxId: 1, businessType: 1, currency: 1, address: 1 } }),
    Promise.all(["products", "sales", "parties", "purchaseorders"].map((c) => d.collection(c).countDocuments({ orgId: _id }))),
  ]);
  return {
    id: orgId, name: String(org.name), createdAt: org.createdAt as Date, settings,
    members: members.map((m) => ({ role: m.role, email: m.user?.email ?? "", name: m.user?.name ?? "", joinedAt: m.createdAt })),
    subscription: {
      plan: sub?.plan ?? "Standard", priceMonthly: sub?.priceMonthly ?? 0, paidUntil: sub?.paidUntil ?? null, status: sub?.status ?? "active",
      lockReason: sub?.lockReason ?? "", notes: sub?.notes ?? "", payments: [...(sub?.payments ?? [])].reverse(), state: lockReason(sub) ?? "active",
    },
    counts: { products: counts[0], sales: counts[1], parties: counts[2], purchases: counts[3] },
  };
}

export async function recentAudit(limit = 30) {
  await connectDb();
  return ProviderAudit.find().sort({ createdAt: -1 }).limit(limit).lean();
}

/* ---------------- writes ---------------- */

export interface NewSeller {
  storeName: string; ownerName: string; email: string; password: string; phone: string; stateCode: string; taxId: string;
  plan: string; priceMonthly: number; paidUntil: string | null;
}

export async function createSeller(p: ProviderUser, input: NewSeller) {
  await connectDb();
  const email = input.email.toLowerCase().trim();
  const user = await createLogin(email, input.ownerName, input.password);
  let orgId: string | null = null;
  try {
    const org = await auth.api.createOrganization({ body: { name: input.storeName, slug: slugify(input.storeName), userId: user.id } });
    if (!org) throw new AppError("CONFLICT", "Could not create the business.");
    orgId = org.id;
    const ctx: Ctx = { userId: user.id, userName: input.ownerName, userEmail: email, orgId, orgName: org.name, role: "owner" };
    await initializeBusiness(ctx, {
      name: input.storeName, businessType: "Retail store", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata",
      taxMode: "GST", taxId: input.taxId, stateCode: input.stateCode, locationName: "Main Store", sample: false,
    });
    if (input.phone) await (await db()).collection("orgsettings").updateOne({ orgId: new Types.ObjectId(orgId) }, { $set: { phone: input.phone } });
    await Subscription.create({ orgId, plan: input.plan, priceMonthly: input.priceMonthly, paidUntil: input.paidUntil ? new Date(input.paidUntil) : null });
    await audit(p, "seller.create", { id: orgId, name: org.name }, `owner ${email}`);
    return { id: orgId };
  } catch (err) {
    // Roll back so the same email can be used again.
    if (orgId) await wipeOrg(orgId).catch(() => undefined);
    await removeUser(user.id).catch(() => undefined);
    throw err;
  }
}

async function orgName(orgId: string) {
  const o = await (await db()).collection("organization").findOne({ _id: new Types.ObjectId(orgId) }, { projection: { name: 1 } });
  if (!o) throw new AppError("NOT_FOUND", "Seller not found");
  return String(o.name);
}

async function memberUserIds(orgId: string) {
  return (await (await db()).collection("member").find({ organizationId: new Types.ObjectId(orgId) }, { projection: { userId: 1 } }).toArray()).map((m) => m.userId as Types.ObjectId);
}

/** Signs every member of the business out of every device (web, desktop, phone, API tokens). */
async function revokeSessions(orgId: string) {
  const ids = await memberUserIds(orgId);
  await (await db()).collection("session").deleteMany({ userId: { $in: ids } });
}

export async function updateSubscription(p: ProviderUser, orgId: string, input: { plan: string; priceMonthly: number; paidUntil: string | null; notes: string }) {
  const name = await orgName(orgId);
  await Subscription.updateOne(
    { orgId },
    { $set: { plan: input.plan, priceMonthly: input.priceMonthly, paidUntil: input.paidUntil ? new Date(input.paidUntil) : null, notes: input.notes } },
    { upsert: true },
  );
  await audit(p, "subscription.update", { id: orgId, name }, `${input.plan}, paid until ${input.paidUntil ?? "no expiry"}`);
}

/** Records money received and extends "paid until" by the months paid for (from today if already expired). */
export async function recordPayment(p: ProviderUser, orgId: string, input: { amount: number; months: number; method: string; reference: string; note: string }) {
  const name = await orgName(orgId);
  const sub = await Subscription.findOne({ orgId }).lean();
  const from = sub?.paidUntil && sub.paidUntil.getTime() > Date.now() ? new Date(sub.paidUntil) : new Date();
  from.setMonth(from.getMonth() + input.months);
  await Subscription.updateOne(
    { orgId },
    { $set: { paidUntil: from }, $push: { payments: { ...input, paidAt: new Date(), recordedBy: p.email } } },
    { upsert: true },
  );
  await audit(p, "subscription.payment", { id: orgId, name }, `${input.amount / 100} for ${input.months} month(s) via ${input.method}`);
  return { paidUntil: from };
}

export async function setLocked(p: ProviderUser, orgId: string, locked: boolean, reason: string) {
  const name = await orgName(orgId);
  await Subscription.updateOne({ orgId }, { $set: { status: locked ? "locked" : "active", lockReason: locked ? reason : "" } }, { upsert: true });
  if (locked) await revokeSessions(orgId);
  await audit(p, locked ? "seller.lock" : "seller.unlock", { id: orgId, name }, reason);
}

export async function resetOwnerPassword(p: ProviderUser, orgId: string, password: string) {
  const name = await orgName(orgId);
  const d = await db();
  const owner = await d.collection("member").findOne({ organizationId: new Types.ObjectId(orgId), role: "owner" }, { projection: { userId: 1 } });
  if (!owner) throw new AppError("NOT_FOUND", "This business has no owner");
  await d.collection("account").updateOne({ userId: owner.userId, providerId: "credential" }, { $set: { password: await hashPassword(password) } });
  await d.collection("session").deleteMany({ userId: owner.userId });
  await audit(p, "seller.reset_password", { id: orgId, name });
}

async function removeUser(userId: string | Types.ObjectId) {
  const d = await db();
  const id = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  if (await ProviderAdmin.exists({ userId: String(id) })) return;
  await Promise.all(["session", "account", "twoFactor"].map((c) => d.collection(c).deleteMany({ userId: id })));
  await d.collection("user").deleteOne({ _id: id });
}

/** Deletes every record of the business: stock, sales, khata, files, members, invitations, subscription. */
async function wipeOrg(orgId: string) {
  const d = await db();
  const _id = new Types.ObjectId(orgId);
  await Promise.all(Object.values(mongoose.models).filter((m) => m.schema.path("orgId")).map((m) => m.deleteMany({ orgId: _id })));
  await Promise.all([d.collection("invitation").deleteMany({ organizationId: _id }), d.collection("member").deleteMany({ organizationId: _id })]);
  await d.collection("organization").deleteOne({ _id });
  // Same path shape as the upload route; orgId is a validated 24-hex id, so this can't escape UPLOAD_DIR.
  await rm(path.resolve(env.UPLOAD_DIR, "images", orgId), { recursive: true, force: true });
  await rm(path.resolve(env.UPLOAD_DIR, "docs", orgId), { recursive: true, force: true });
}

/** Permanent. Users who belonged only to this business are deleted too. */
export async function deleteSeller(p: ProviderUser, orgId: string, confirmName: string) {
  const name = await orgName(orgId);
  if (confirmName.trim() !== name) throw new AppError("INVALID", "Type the store name exactly to confirm.");
  const d = await db();
  const users = await memberUserIds(orgId);
  await revokeSessions(orgId);
  await wipeOrg(orgId);
  for (const u of users) if (!(await d.collection("member").findOne({ userId: u }))) await removeUser(u);
  await audit(p, "seller.delete", { id: orgId, name }, `${users.length} user(s)`);
}
