import { describe, expect, it } from "vitest";

// Multi-tenancy is enforced in the data layer, not just in pages: every model that belongs to a business
// must refuse to run a query that doesn't name the business. This test fails the moment a new
// collection is added without that protection, so tenant isolation can't be forgotten.

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/tenancy-test";
const { default: mongoose } = await import("mongoose");
await import("@/server/models");

// Collections that are deliberately NOT per-business (provider-side data and login throttling).
const GLOBAL = new Set(["Subscription", "ProviderAdmin", "ProviderAudit", "LoginAttempt", "RateLimit", "Enquiry"]);

const all = Object.entries(mongoose.models);

describe("tenant isolation", () => {
  it("knows every collection: business data carries orgId, the rest is on the explicit global list", () => {
    for (const [name, m] of all) {
      const hasOrg = !!m.schema.path("orgId") || name === "Subscription"; // subscriptions key on orgId too
      expect(hasOrg || GLOBAL.has(name), `${name} has no orgId and isn't on the global list`).toBe(true);
    }
  });

  it("every business model throws when queried without orgId", async () => {
    const tenant = all.filter(([name, m]) => m.schema.path("orgId") && !GLOBAL.has(name));
    expect(tenant.length).toBeGreaterThan(10);
    for (const [name, m] of tenant) {
      // The guard runs before the query would reach the database, so no connection is needed.
      await expect(m.find({}).exec(), `${name}.find({})`).rejects.toThrow(/Tenant scope missing/);
      await expect(m.updateMany({}, { $set: { x: 1 } }).exec(), `${name}.updateMany({})`).rejects.toThrow(/Tenant scope missing/);
      await expect(m.deleteMany({}).exec(), `${name}.deleteMany({})`).rejects.toThrow(/Tenant scope missing/);
      await expect(m.countDocuments({}).exec(), `${name}.countDocuments({})`).rejects.toThrow(/Tenant scope missing/);
    }
  });
});
