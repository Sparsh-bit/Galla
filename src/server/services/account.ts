import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { env } from "@/env";
import { connectDb } from "../db";
import { LoginAttempt } from "../models";

// Account deletion (required by Google Play and the DPDP Act): what goes, what blocks it, and doing it.
//
// - A business where the person is the only member is deleted with all of its data and files.
// - A business with other members: they simply leave it. If they are its only owner, deletion is
//   blocked until they make someone else an owner, so a shop is never left without one.

export interface DeletionPlan {
  businesses: { id: string; name: string; role: string; members: number; action: "delete" | "leave" | "blocked" }[];
  blockers: string[];
}

export async function deletionPlan(userId: string): Promise<DeletionPlan> {
  const { connection } = await connectDb();
  const db = connection.db!;
  const uid = new ObjectId(userId);
  const memberships = await db.collection("member").find({ userId: uid }, { projection: { organizationId: 1, role: 1 } }).toArray();
  const businesses: DeletionPlan["businesses"] = [];
  const blockers: string[] = [];
  for (const m of memberships) {
    const org = await db.collection("organization").findOne({ _id: m.organizationId }, { projection: { name: 1 } });
    if (!org) continue;
    const others = await db.collection("member").find({ organizationId: m.organizationId, userId: { $ne: uid } }, { projection: { role: 1 } }).toArray();
    const name = String(org.name);
    let action: "delete" | "leave" | "blocked" = others.length === 0 ? "delete" : "leave";
    if (others.length && m.role === "owner" && !others.some((o) => o.role === "owner")) {
      action = "blocked";
      blockers.push(`${name} has other members but no other owner. Make one of them an owner in Settings → Team, or remove them, first.`);
    }
    businesses.push({ id: String(m.organizationId), name, role: String(m.role), members: others.length + 1, action });
  }
  return { businesses, blockers };
}

/** Removes every record and file of a business. Only call for a business with no other members. */
async function wipeBusiness(orgId: string) {
  const { connection } = await connectDb();
  const db = connection.db!;
  const oid = new ObjectId(orgId);
  const tenantModels = Object.values(mongoose.models).filter((m) => m.schema.path("orgId"));
  // Tenant models store orgId as an ObjectId or a string depending on age; clear both shapes.
  await Promise.all(tenantModels.map((m) => m.collection.deleteMany({ orgId: { $in: [oid, orgId] } })));
  await Promise.all([
    db.collection("invitation").deleteMany({ organizationId: { $in: [oid, orgId] } }),
    db.collection("member").deleteMany({ organizationId: { $in: [oid, orgId] } }),
    db.collection("organization").deleteOne({ _id: oid }),
  ]);
  const root = path.resolve(env.UPLOAD_DIR);
  for (const kind of ["images", "docs"]) {
    const dir = path.resolve(root, kind, orgId);
    if (dir.startsWith(root + path.sep)) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Runs inside Better Auth's delete-user flow, after the password check and before the user row goes. */
export async function deleteAccountData(userId: string, email: string) {
  const plan = await deletionPlan(userId);
  if (plan.blockers.length) throw new Error(plan.blockers[0]);
  for (const b of plan.businesses) if (b.action === "delete") await wipeBusiness(b.id);
  const { connection } = await connectDb();
  const db = connection.db!;
  const uid = new ObjectId(userId);
  await Promise.all([
    db.collection("member").deleteMany({ userId: { $in: [uid, userId] } }),
    db.collection("twoFactor").deleteMany({ userId: { $in: [uid, userId] } }),
    db.collection("account").deleteMany({ userId: { $in: [uid, userId] } }),
    db.collection("invitation").deleteMany({ email: email.toLowerCase(), status: "pending" }),
    LoginAttempt.deleteMany({ email: email.toLowerCase() }),
  ]);
}
