// Speed check with a big shop. Run on purpose:  BENCH=1 npx vitest run tests/perf/bench.test.ts
// Seeds BENCH_PRODUCTS products (default 20000) and as many bills, then times what a counter does all day.
import { ALL_FEATURES } from "@/lib/features";
import { afterAll, beforeAll, describe, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Ctx } from "@/server/context";

const N = Number(process.env.BENCH_PRODUCTS ?? 20000);
let rs: MongoMemoryReplSet;
const ctx: Ctx = { userId: "u", userName: "Bench", userEmail: "b@x.test", orgId: new mongoose.Types.ObjectId().toHexString(), orgName: "Bench Mart", role: "owner", features: ALL_FEATURES, plan: "Business", maxStaff: 0 };
const times: [string, number][] = [];
const time = async <T>(label: string, fn: () => Promise<T>, reps = 3): Promise<T> => {
  let out!: T;
  const t: number[] = [];
  for (let i = 0; i < reps; i++) {
    const s = performance.now();
    out = await fn();
    t.push(performance.now() - s);
  }
  const best = Math.min(...t);
  times.push([label, Math.round(best)]);
  return out;
};

const WORDS = ["Rice", "Basmati", "Sugar", "Tea", "Soap", "Oil", "Atta", "Dal", "Salt", "Biscuit", "Notebook", "Pen", "Cable", "Charger", "Shirt", "Jeans", "Milk", "Paneer", "Chai", "Coffee"];

describe.skipIf(!process.env.BENCH)("speed with a big shop", () => {
  let M: typeof import("@/server/models");
  let svc: { products: typeof import("@/server/services/products"); reports: typeof import("@/server/services/reports"); offline: typeof import("@/server/services/offline") };
  let locationId = "";

  beforeAll(async () => {
    rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    Object.assign(process.env, { MONGODB_URI: rs.getUri("bench"), BETTER_AUTH_SECRET: "x".repeat(40), APP_URL: "http://localhost:3000" });
    const { connectDb } = await import("@/server/db");
    await connectDb();
    M = await import("@/server/models");
    svc = { products: await import("@/server/services/products"), reports: await import("@/server/services/reports"), offline: await import("@/server/services/offline") };
    await (await import("@/server/services/onboarding")).initializeBusiness(ctx, { name: "Bench", businessType: "Retail store", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata", taxMode: "GST", taxId: "", stateCode: "27", locationName: "Main", sample: false });
    locationId = String((await M.Location.findOne({ orgId: ctx.orgId, isDefault: true }).lean())!._id);
    await M.Product.init();
    await M.StockLevel.init();
    await M.Sale.init();

    const orgId = new mongoose.Types.ObjectId(ctx.orgId);
    const docs = [];
    const levels = [];
    for (let i = 0; i < N; i++) {
      const _id = new mongoose.Types.ObjectId();
      const vid = new mongoose.Types.ObjectId();
      const name = `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} ${i}`;
      docs.push({ _id, orgId, name, brand: i % 5 ? "" : "Acme", unit: { code: "pcs", scale: 1 }, active: true, reorderLevel: i % 9 === 0 ? 10 : 0, priceIncludesTax: true, variants: [{ _id: vid, name: "", sku: `SKU${i}`, barcodes: [String(100000000 + i)], salePrice: 1000 + (i % 500), costPrice: 700, mrp: 0, active: true }] });
      levels.push({ orgId, locationId: new mongoose.Types.ObjectId(locationId), variantId: vid, batchId: null, qty: i % 7 === 0 ? 3 : 50 + (i % 100) });
    }
    for (let i = 0; i < docs.length; i += 5000) await M.Product.insertMany(docs.slice(i, i + 5000), { ordered: false, lean: true });
    for (let i = 0; i < levels.length; i += 5000) await M.StockLevel.insertMany(levels.slice(i, i + 5000), { ordered: false, lean: true });
    const sales = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const d = docs[(i * 13) % docs.length];
      sales.push({ orgId, number: `S/${i}`, kind: "receipt", status: "completed", completedAt: new Date(now - (i % 90) * 86400e3 - (i % 1000) * 1000), createdAt: new Date(now), grandTotal: 1000 + (i % 500), subtotal: 1000, taxTotal: 0, balanceDue: 0, payments: [{ method: "cash", amount: 1000 }], lines: [{ productId: d._id, variantId: d.variants[0]._id, name: d.name, sku: d.variants[0].sku, unit: "pcs", scale: 1, qty: 1, unitPrice: 1000, total: 1000, costPrice: 700 }] });
    }
    for (let i = 0; i < sales.length; i += 5000) await M.Sale.insertMany(sales.slice(i, i + 5000), { ordered: false, lean: true });
  }, 600_000);

  afterAll(async () => {
    const report = `\nSpeed with ${N} products and ${N} bills (best of 3, milliseconds):\n` + times.map(([l, ms]) => `  ${String(ms).padStart(6)} ms  ${l}`).join("\n") + "\n";
    console.log(report);
    (await import("node:fs")).writeFileSync(process.env.BENCH_OUT ?? "/tmp/bench.txt", report);
    await mongoose.disconnect();
    await rs.stop();
  });

  it("times the counter's everyday operations", async () => {
    await time("search: 'rice' (name word)", () => svc.products.searchVariants(ctx, "rice", locationId, 20));
    await time("search: 'bas ric' (two words)", () => svc.products.searchVariants(ctx, "bas ric", locationId, 20));
    await time("search: 'SKU1234'", () => svc.products.searchVariants(ctx, "SKU1234", locationId, 20));
    await time("search: single letter 'a'", () => svc.products.searchVariants(ctx, "a", locationId, 20));
    await time("scan barcode (exact)", () => svc.products.findByCode(ctx, "100012345", locationId));
    await time("number pad: unknown number '123'", () => svc.products.findByCode(ctx, "123", locationId));
    await time("low stock (2000)", () => svc.reports.lowStock(ctx, 2000));
    await time("reorder list", () => svc.reports.reorderList(ctx), 1);
    const day = 86400e3;
    await time("sales totals: 30 days", () => svc.reports.salesTotals(ctx, new Date(Date.now() - 30 * day), new Date(Date.now() + day)));
    await time("top products: 30 days", () => svc.reports.salesByProduct(ctx, new Date(Date.now() - 30 * day), new Date(Date.now() + day), 5));
    const snap = await time("offline till catalogue (whole shop)", () => svc.offline.posSnapshot(ctx, locationId), 1);
    times.push([`   (that catalogue is ${(JSON.stringify(snap).length / 1048576).toFixed(1)} MB)`, 0]);
  }, 600_000);
});
