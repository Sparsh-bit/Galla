import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Ctx } from "@/server/context";

// Account deletion (Google Play / DPDP requirement): what is removed, what is kept, what blocks it.

let rs: MongoMemoryReplSet;
let account: typeof import("@/server/services/account");
let onboarding: typeof import("@/server/services/onboarding");
let models: typeof import("@/server/models");

const oid = () => new mongoose.Types.ObjectId();
const db = () => mongoose.connection.db!;

async function makeBusiness(members: { userId: mongoose.Types.ObjectId; role: string }[]) {
  const orgId = oid();
  await db().collection("organization").insertOne({ _id: orgId, name: `Shop ${orgId.toHexString().slice(-4)}`, slug: orgId.toHexString(), createdAt: new Date() });
  await db().collection("member").insertMany(members.map((m) => ({ organizationId: orgId, userId: m.userId, role: m.role, createdAt: new Date() })));
  const owner = members.find((m) => m.role === "owner")!;
  const ctx: Ctx = { userId: owner.userId.toHexString(), userName: "Owner", userEmail: "o@example.com", orgId: orgId.toHexString(), orgName: "Shop", role: "owner" };
  await onboarding.initializeBusiness(ctx, { name: "Shop", businessType: "Retail store", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata", taxMode: "GST", taxId: "", stateCode: "27", locationName: "Main", sample: true });
  return orgId;
}

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  Object.assign(process.env, { MONGODB_URI: rs.getUri("galla-account-test"), BETTER_AUTH_SECRET: "x".repeat(40), APP_URL: "http://localhost:3000", UPLOAD_DIR: "./.data/test-uploads" });
  const { connectDb } = await import("@/server/db");
  await connectDb();
  account = await import("@/server/services/account");
  onboarding = await import("@/server/services/onboarding");
  models = await import("@/server/models");
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await rs?.stop();
});

describe("account deletion", () => {
  it("deletes a business the person runs alone, with all its data", async () => {
    const me = oid();
    const orgId = await makeBusiness([{ userId: me, role: "owner" }]);
    expect(await models.Product.countDocuments({ orgId })).toBeGreaterThan(0);

    const plan = await account.deletionPlan(me.toHexString());
    expect(plan.blockers).toHaveLength(0);
    expect(plan.businesses).toEqual([expect.objectContaining({ id: orgId.toHexString(), action: "delete", members: 1 })]);

    await account.deleteAccountData(me.toHexString(), "me@example.com");
    for (const m of [models.Product, models.OrgSettings, models.Location, models.StockLevel, models.AuditLog]) {
      expect(await m.collection.countDocuments({ orgId: { $in: [orgId, orgId.toHexString()] } }), m.modelName).toBe(0);
    }
    expect(await db().collection("organization").countDocuments({ _id: orgId })).toBe(0);
    expect(await db().collection("member").countDocuments({ userId: me })).toBe(0);
  });

  it("blocks deletion while the person is the only owner of a shared business", async () => {
    const me = oid();
    const staff = oid();
    const orgId = await makeBusiness([{ userId: me, role: "owner" }, { userId: staff, role: "cashier" }]);
    const plan = await account.deletionPlan(me.toHexString());
    expect(plan.blockers[0]).toMatch(/no other owner/);
    await expect(account.deleteAccountData(me.toHexString(), "me@example.com")).rejects.toThrow(/owner/);
    expect(await models.Product.countDocuments({ orgId: orgId.toHexString() })).toBeGreaterThan(0);
  });

  it("only removes the membership of staff, leaving the shop and its data", async () => {
    const owner = oid();
    const me = oid();
    const orgId = await makeBusiness([{ userId: owner, role: "owner" }, { userId: me, role: "cashier" }]);
    const plan = await account.deletionPlan(me.toHexString());
    expect(plan.businesses[0]).toMatchObject({ action: "leave" });
    await account.deleteAccountData(me.toHexString(), "me@example.com");
    expect(await db().collection("member").countDocuments({ organizationId: orgId })).toBe(1);
    expect(await models.Product.countDocuments({ orgId: orgId.toHexString() })).toBeGreaterThan(0);
  });
});
