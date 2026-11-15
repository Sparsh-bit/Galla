import "server-only";
import mongoose from "mongoose";

/**
 * One-time data fixes, run at server start (each runs once; the marker is stored in the database).
 * They use the raw collections: they work across every business at once.
 */
async function once(name: string, fn: () => Promise<void>) {
  const done = mongoose.connection.collection("migrations");
  if (await done.findOne({ _id: name as never })) return;
  await fn();
  await done.insertOne({ _id: name as never, at: new Date() });
}

/** "Stock only for items with a real barcode": existing items with only automatic codes or short numbers stop keeping stock, unless they already hold stock records. */
async function noBarcodeNoStock() {
  const products = mongoose.connection.collection("products");
  const withStock = new Set((await mongoose.connection.collection("stocklevels").distinct("productId")).map(String));
  const notReal = { $regexMatch: { input: "$$b", regex: "^(2[0-9]{12}|[0-9]{0,3})$" } }; // automatic in-store code, or a 1-3 digit number
  const cursor = products.find(
    { trackStock: { $ne: false }, trackBatch: { $ne: true }, trackSerial: { $ne: true }, $expr: { $allElementsTrue: { $map: { input: "$variants", as: "v", in: { $allElementsTrue: { $map: { input: "$$v.barcodes", as: "b", in: notReal } } } } } } },
    { projection: { _id: 1 } },
  );
  let batch: mongoose.mongo.ObjectId[] = [];
  let changed = 0;
  const flush = async () => {
    if (!batch.length) return;
    await products.updateMany({ _id: { $in: batch } }, { $set: { trackStock: false } });
    changed += batch.length;
    batch = [];
  };
  for await (const p of cursor) {
    if (withStock.has(String(p._id))) continue; // it has stock records: leave it tracked
    batch.push(p._id as mongoose.mongo.ObjectId);
    if (batch.length >= 1000) await flush();
  }
  await flush();
  console.info(`[migrate] items without a real barcode stopped keeping stock: ${changed}`);
}

export async function runMigrations() {
  try {
    await once("2026-11-no-barcode-no-stock", noBarcodeNoStock);
  } catch (e) {
    console.error("[migrate] failed (will retry next start)", e);
  }
}
