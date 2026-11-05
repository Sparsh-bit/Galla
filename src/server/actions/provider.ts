"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { auth } from "../auth";
import { createSeller, deleteSeller, ensureProviderAdmin, isProviderAdmin, loadProvider, recordPayment, resetOwnerPassword, setLocked, updateSubscription, type ProviderUser } from "../services/provider";
import { toSafeError, type ActionResult } from "../with-auth";
import { signInAction } from "./auth";

const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const password = z.string().min(10, "Use at least 10 characters.").max(128);

/** Every provider action: signed-in provider admin + strict input, errors mapped to safe messages. */
function withProvider<S extends z.ZodType, T>(schema: S, fn: (p: ProviderUser, input: z.output<S>) => Promise<T>) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const p = await loadProvider();
      if (!p) return { ok: false, code: "UNAUTHENTICATED", error: "Please sign in to the provider portal again." };
      const parsed = schema.safeParse(input);
      if (!parsed.success) return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Please check the form." };
      const data = await fn(p, parsed.data);
      revalidatePath("/provider", "layout");
      return { ok: true, data };
    } catch (err) {
      unstable_rethrow(err);
      return { ok: false, ...toSafeError(err) };
    }
  };
}

/** Provider sign-in: the first-run admin from the server environment is created here if missing. */
export async function providerSignIn(input: { email: string; password: string }): Promise<ActionResult<null>> {
  try {
    await ensureProviderAdmin();
  } catch (err) {
    console.error("[provider] bootstrap failed", err);
  }
  // Check the account first, so a non-admin never even gets a session here.
  const user = await (await auth.$context).internalAdapter.findUserByEmail(String(input.email ?? "").toLowerCase().trim());
  if (!user || !(await isProviderAdmin(user.user.id))) {
    await new Promise((r) => setTimeout(r, 400)); // same pace as a wrong password, so this doesn't reveal which emails exist
    return { ok: false, error: "This account doesn't have provider access." };
  }
  const r = await signInAction(input);
  if (!r.ok) return r;
  if (r.data.twoFactor) return { ok: false, error: "Finish two-step sign-in on the main sign-in page first." };
  return { ok: true, data: null };
}

export const createSellerAction = withProvider(
  z.object({
    storeName: z.string().trim().min(2, "Enter the store name").max(120),
    ownerName: z.string().trim().min(1, "Enter the owner's name").max(100),
    email: z.email("Enter a valid email").max(200),
    password,
    phone: z.string().trim().regex(/^[+\d][\d\s-]{5,19}$|^$/, "Invalid phone").default(""),
    stateCode: z.string().regex(/^(\d{2})?$/).default(""),
    taxId: z.string().trim().toUpperCase().regex(/^(\d{2}[A-Z0-9]{13})?$/, "GSTIN must be 15 characters").default(""),
    plan: z.string().trim().min(1).max(60).default("Standard"),
    priceMonthly: z.number().int().min(0).max(1e10).default(0),
    paidUntil: day.nullable().default(null),
  }).strict(),
  (p, i) => createSeller(p, i),
);

export const updateSubscriptionAction = withProvider(
  z.object({ orgId: objectId, plan: z.string().trim().min(1).max(60), priceMonthly: z.number().int().min(0).max(1e10), paidUntil: day.nullable(), notes: z.string().trim().max(2000).default("") }).strict(),
  (p, { orgId, ...i }) => updateSubscription(p, orgId, i),
);

export const recordPaymentAction = withProvider(
  z.object({ orgId: objectId, amount: z.number().int().min(1).max(1e10), months: z.number().int().min(1).max(60), method: z.enum(["upi", "bank", "cash", "card", "other"]), reference: z.string().trim().max(100).default(""), note: z.string().trim().max(300).default("") }).strict(),
  (p, { orgId, ...i }) => recordPayment(p, orgId, i),
);

export const setLockedAction = withProvider(
  z.object({ orgId: objectId, locked: z.boolean(), reason: z.string().trim().max(300).default("") }).strict(),
  (p, i) => setLocked(p, i.orgId, i.locked, i.reason),
);

export const resetOwnerPasswordAction = withProvider(z.object({ orgId: objectId, password }).strict(), (p, i) => resetOwnerPassword(p, i.orgId, i.password));

export const deleteSellerAction = withProvider(z.object({ orgId: objectId, confirmName: z.string().max(200) }).strict(), (p, i) => deleteSeller(p, i.orgId, i.confirmName));
