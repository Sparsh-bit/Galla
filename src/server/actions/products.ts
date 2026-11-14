"use server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { seesCost } from "@/lib/permissions";
import { objectId, productInput } from "@/lib/schemas";
import { AppError, needFeature, type Ctx } from "../context";
import { Category, Product, TaxRate } from "../models";
import { createProduct, findByCode, searchVariants, setProductActive, updateProduct } from "../services/products";
import { inStockSerials } from "../services/serials";
import { audit } from "../services/system";
import { withAuth } from "../with-auth";

export const saveProduct = withAuth("products:write", z.object({ id: objectId.nullable(), data: productInput }).strict(), async (ctx, { id, data }) => {
  if (data.trackSerial) needFeature(ctx, "serials", "Serial / IMEI tracking");
  if (data.trackBatch) needFeature(ctx, "batches", "Batches & expiry");
  // Images uploaded to another business can't be attached here.
  if (data.images.some((url) => url.startsWith("/api/org-files/") && !url.startsWith(`/api/org-files/${ctx.orgId}/`))) {
    throw new AppError("INVALID", "Upload the image again.", { images: ["Upload the image again."] });
  }
  const legacyImages = data.images.filter((url) => /^\/api\/files\/[a-f0-9]{32}\.(?:webp|png|jpg)$/.test(url));
  if (legacyImages.length) {
    const existing = id ? await Product.findOne({ orgId: ctx.orgId, _id: id }, { images: 1 }).lean() : null;
    if (legacyImages.some((url) => !existing?.images?.includes(url))) {
      throw new AppError("INVALID", "Legacy images can only remain on the product that already owns them. Upload the image again to move it.");
    }
  }
  const res = id ? await updateProduct(ctx, id, data) : await createProduct(ctx, data);
  revalidatePath("/products");
  return res;
});

/** The next unused short product number (1, 2, 3 ...) that staff can type on the number pad at the counter. */
export const nextProductNumber = withAuth("products:read", z.object({}).strict(), async (ctx) => {
  const rows = await Product.aggregate<{ max: number }>([
    { $match: { orgId: new mongoose.Types.ObjectId(ctx.orgId) } },
    { $unwind: "$variants" },
    { $project: { all: { $concatArrays: [["$variants.sku"], "$variants.barcodes"] } } },
    { $unwind: "$all" },
    { $match: { all: { $regex: /^[1-9]\d{0,5}$/ } } }, // short numbers only; long digit strings are real EAN barcodes
    { $group: { _id: null, max: { $max: { $toInt: "$all" } } } },
  ]);
  return { number: String((rows[0]?.max ?? 0) + 1) };
});

export const archiveProduct = withAuth("products:write", z.object({ id: objectId, active: z.boolean() }).strict(), async (ctx, { id, active }) => {
  await setProductActive(ctx, id, active);
  revalidatePath("/products");
  return null;
});

const hideCost = <T extends { costPrice: number }>(ctx: Ctx, h: T): T => (seesCost(ctx.role) ? h : { ...h, costPrice: 0 });

export const searchProducts = withAuth("products:read", z.object({ q: z.string().max(80), locationId: objectId.optional() }).strict(), async (ctx, { q, locationId }) =>
  (await searchVariants(ctx, q, locationId, 24)).map((h) => hideCost(ctx, h)),
);

export const lookupCode = withAuth("products:read", z.object({ code: z.string().trim().min(1).max(64), locationId: objectId.optional() }).strict(), async (ctx, { code, locationId }) => {
  const h = await findByCode(ctx, code, locationId);
  return h && hideCost(ctx, h);
});

export const saveCategory = withAuth("products:write", z.object({ id: objectId.nullable(), name: z.string().trim().min(1).max(80), parentId: objectId.nullable() }).strict(), async (ctx, i) => {
  if (i.id) {
    if (i.parentId === i.id) throw new AppError("INVALID", "A category can't be its own parent.");
    const r = await Category.updateOne({ orgId: ctx.orgId, _id: i.id }, { $set: { name: i.name, parentId: i.parentId } });
    if (!r.matchedCount) throw new AppError("NOT_FOUND", "Category not found");
  } else {
    await Category.create({ orgId: ctx.orgId, name: i.name, parentId: i.parentId });
  }
  await audit(ctx, i.id ? "update" : "create", "category", i.id ?? "", `Saved category ${i.name}`);
  revalidatePath("/products/categories");
  return null;
});

export const deleteCategory = withAuth("products:write", z.object({ id: objectId }).strict(), async (ctx, { id }) => {
  if (await Product.exists({ orgId: ctx.orgId, categoryId: id })) throw new AppError("CONFLICT", "Move the products in this category first.");
  if (await Category.exists({ orgId: ctx.orgId, parentId: id })) throw new AppError("CONFLICT", "Delete or move its sub-categories first.");
  await Category.deleteOne({ orgId: ctx.orgId, _id: id });
  await audit(ctx, "delete", "category", id, "Deleted category");
  revalidatePath("/products/categories");
  return null;
});

export const listTaxRates = withAuth("products:read", z.object({}).strict(), async (ctx) =>
  (await TaxRate.find({ orgId: ctx.orgId }).sort({ rateBp: 1 }).lean()).map((r) => ({ id: String(r._id), name: r.name, rateBp: r.rateBp })),
);

export const availableSerials = withAuth("products:read", z.object({ variantId: objectId, locationId: objectId }).strict(), (ctx, i) => inStockSerials(ctx, i.variantId, i.locationId));
