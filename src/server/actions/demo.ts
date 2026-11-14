"use server";
// Public demo site: a visitor sends an enquiry and is signed straight into a private sample shop
// that lives for 24 hours. No login screen, no password to remember.
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { ALL_FEATURES } from "@/lib/features";
import { CONTACT } from "@/lib/concilio";
import { auth } from "../auth";
import { AppError, type Ctx } from "../context";
import { connectDb } from "../db";
import { sendMail } from "../mail";
import { Enquiry, RateLimit, Subscription } from "../models";
import { initializeBusiness, slugify } from "../services/onboarding";
import { createLogin, purgeExpiredDemos, removeUser, wipeOrg } from "../services/provider";
import { toSafeError, type ActionResult } from "../with-auth";

const DEMO_HOURS = 24;
const input = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{7,19}$/, "Enter a valid phone number"),
  email: z.union([z.literal(""), z.email("Enter a valid email").max(200)]).default(""),
  business: z.string().trim().min(2, "Enter your shop or business name").max(120),
  city: z.string().trim().max(80).default(""),
  message: z.string().trim().max(1000).default(""),
  website: z.string().max(0).default(""), // honeypot: real people leave it empty
}).strict();

export async function startDemo(raw: z.input<typeof input>): Promise<ActionResult<{ next: string }>> {
  try {
    if (env.DEMO_MODE !== "true") return { ok: false, error: "The demo is not available on this site." };
    const p = input.safeParse(raw);
    if (!p.success) return { ok: false, code: "INVALID", error: p.error.issues[0]?.message ?? "Please check the form." };
    if (p.data.website) return { ok: true, data: { next: "/" } }; // bots get nothing, quietly
    await connectDb();
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
    const rate = await RateLimit.findOneAndUpdate(
      { key: `demo:${ip}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 3600_000) } },
      { upsert: true, returnDocument: "after" },
    );
    if ((rate?.count ?? 0) > 5) return { ok: false, error: "Too many demo requests from this network. Please try again in an hour, or call us." };

    void purgeExpiredDemos().catch(() => undefined);

    // A throwaway owner login and shop with sample products; the visitor never sees the credentials.
    const email = `demo-${randomBytes(6).toString("hex")}@demo.galla.invalid`;
    const password = randomBytes(24).toString("base64url");
    const user = await createLogin(email, p.data.name, password);
    let orgId: string | null = null;
    try {
      const org = await auth.api.createOrganization({ body: { name: p.data.business, slug: slugify(p.data.business), userId: user.id } });
      if (!org) throw new AppError("CONFLICT", "Could not create the demo shop.");
      orgId = org.id;
      const ctx: Ctx = { userId: user.id, userName: p.data.name, userEmail: email, orgId, orgName: org.name, role: "owner", features: ALL_FEATURES, plan: "Demo", maxStaff: 1 };
      await initializeBusiness(ctx, {
        name: p.data.business, businessType: "Retail store", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata",
        taxMode: "GST", taxId: "", stateCode: "", locationName: "Main Store", sample: true,
      });
      await Subscription.create({
        orgId, plan: "Demo", demo: true, maxStaff: 1,
        features: ALL_FEATURES.filter((f) => f !== "einvoice" && f !== "multishop"), // no live GST portal calls from a demo
        paidUntil: new Date(Date.now() + DEMO_HOURS * 3600_000),
      });
      await Enquiry.create({ ...p.data, ip, demoOrgId: orgId });
      await auth.api.signInEmail({ body: { email, password }, headers: h }); // sets the session cookie
    } catch (err) {
      if (orgId) await wipeOrg(orgId).catch(() => undefined);
      await removeUser(user.id).catch(() => undefined);
      throw err;
    }

    // Tell the team; a failed email must never block the visitor.
    void sendMail(
      CONTACT.email,
      `Galla demo enquiry: ${p.data.business}`,
      `${p.data.name} (${p.data.phone}${p.data.email ? ", " + p.data.email : ""}) from ${p.data.business}${p.data.city ? ", " + p.data.city : ""} opened the demo.${p.data.message ? "\n\n" + p.data.message : ""}`,
    ).catch((e) => console.error("[demo] enquiry email failed", e));
    return { ok: true, data: { next: "/dashboard" } };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, ...toSafeError(err) };
  }
}
