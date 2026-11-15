import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let rs: MongoMemoryReplSet;
beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(rs.getUri("migrate-test")); // not connectDb(): it would run the migration before the data exists
});
afterAll(async () => {
  await mongoose.disconnect();
  await rs.stop();
});

const product = (name: string, barcodes: string[], extra: Record<string, unknown> = {}) => ({
  _id: new mongoose.Types.ObjectId(), orgId: new mongoose.Types.ObjectId(), name, active: true, trackBatch: false, trackSerial: false,
  variants: [{ _id: new mongoose.Types.ObjectId(), sku: name, barcodes, salePrice: 100 }], ...extra,
});

describe("one-time fix: no barcode, no stock", () => {
  it("stops tracking items with only automatic codes or short numbers, and nothing else", async () => {
    const col = mongoose.connection.collection("products");
    const plain = product("Plain", ["2000000000015"]); // automatic code only
    const numbered = product("Numbered", ["12"]); // short number only
    const real = product("Real", ["8901234567890"]); // real barcode
    const mixed = product("Mixed", ["2000000000022", "8908000000001"]); // has a real one too
    const heldStock = product("Held", ["2000000000039"]); // has stock records: untouched
    const batch = product("Batch", ["2000000000046"], { trackBatch: true });
    await col.insertMany([plain, numbered, real, mixed, heldStock, batch]);
    await mongoose.connection.collection("stocklevels").insertOne({ orgId: heldStock.orgId, productId: heldStock._id, variantId: heldStock.variants[0]._id, qty: 4 });

    const { runMigrations } = await import("@/server/services/migrations");
    await runMigrations();

    const flag = async (p: { _id: mongoose.Types.ObjectId }) => (await col.findOne({ _id: p._id }))!.trackStock;
    expect(await flag(plain)).toBe(false);
    expect(await flag(numbered)).toBe(false);
    expect(await flag(real)).toBeUndefined(); // still tracked (default)
    expect(await flag(mixed)).toBeUndefined();
    expect(await flag(heldStock)).toBeUndefined();
    expect(await flag(batch)).toBeUndefined();

    // Runs once: a later item with only an automatic code is not touched again.
    const later = product("Later", ["2000000000053"]);
    await col.insertOne(later);
    await runMigrations();
    expect(await flag(later)).toBeUndefined();
  });
});
