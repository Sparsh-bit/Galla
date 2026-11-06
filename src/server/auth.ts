import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { twoFactor } from "better-auth/plugins/two-factor";
import { bearer } from "better-auth/plugins/bearer";
import { MongoClient, ObjectId } from "mongodb";
import { env } from "@/env";
import { sendMail } from "./mail";
import { connectDb } from "./db";
import { LoginAttempt, ProviderAdmin } from "./models";
import { deleteAccountData } from "./services/account";
import { lockReason } from "./services/subscription";

const g = globalThis as unknown as { __authMongo?: MongoClient };
const client = (g.__authMongo ??= new MongoClient(env.MONGODB_URI));
const db = client.db();

const MAX_FAILED_LOGINS = 5;

export const auth = betterAuth({
  appName: "Galla",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: mongodbAdapter(db, { client }),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(user.email, "Reset your Galla password", "Someone requested a password reset for your account. If it wasn't you, ignore this email.", { url, label: "Reset password" });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(user.email, "Verify your email", `Hi ${user.name}, confirm your email address to start using Galla.`, { url, label: "Verify email" });
    },
  },
  user: {
    // In-app account deletion (Google Play requirement). Password-confirmed; see services/account.ts.
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        try {
          await deleteAccountData(user.id, user.email);
        } catch (e) {
          throw new APIError("BAD_REQUEST", { message: e instanceof Error ? e.message : "Could not delete the account." });
        }
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/two-factor/verify-totp": { window: 300, max: 10 },
      "/two-factor/verify-backup-code": { window: 300, max: 10 },
    },
  },
  advanced: {
    useSecureCookies: env.APP_URL.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  databaseHooks: {
    session: {
      create: {
        // Land users in their first business so every page has an active org.
        before: async (session) => {
          const member = await db.collection("member").findOne({ userId: new ObjectId(session.userId) }, { sort: { createdAt: 1 } });
          return { data: { ...session, activeOrganizationId: member ? String(member.organizationId) : null } };
        },
      },
    },
  },
  hooks: {
    // Per-account lockout on top of per-IP rate limiting.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") return guardSignUp(String((ctx.body as { email?: string })?.email ?? "").toLowerCase().trim());
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: string })?.email ?? "").toLowerCase();
      await connectDb();
      const attempt = await LoginAttempt.findOne({ email }).lean();
      if (attempt && attempt.count >= MAX_FAILED_LOGINS) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many failed attempts. Try again in 15 minutes or reset your password." });
      }
      await guardLocked(email);
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: string })?.email ?? "").toLowerCase();
      const returned = ctx.context.returned;
      await connectDb();
      if (isAPIError(returned) && returned.status === "UNAUTHORIZED") {
        await LoginAttempt.updateOne({ email }, { $inc: { count: 1 }, $setOnInsert: { firstAt: new Date() } }, { upsert: true });
      } else if (!isAPIError(returned)) {
        await LoginAttempt.deleteOne({ email });
      }
    }),
  },
  plugins: [
    organization({
      creatorRole: "owner",
      roles: { owner: ownerAc, manager: memberAc, cashier: memberAc, stockkeeper: memberAc },
      invitationExpiresIn: 60 * 60 * 24 * 7,
      sendInvitationEmail: async ({ email, organization: org, inviter, id }) => {
        await sendMail(email, `Join ${org.name} on Galla`, `${inviter.user.name} invited you to join ${org.name}.`, { url: `${env.APP_URL}/accept-invite/${id}`, label: "Accept invitation" });
      },
    }),
    twoFactor({ issuer: "Galla" }),
    // Desktop/phone apps and API clients send the session token as `Authorization: Bearer`.
    bearer(),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;

/** Accounts are created by Concilio Solutions; sign-up is open only to people with a pending team invitation. */
async function guardSignUp(email: string) {
  if (env.ALLOW_PUBLIC_SIGNUP === "true") return;
  const invited = await db.collection("invitation").findOne({ email, status: "pending", expiresAt: { $gt: new Date() } }, { projection: { _id: 1 } });
  if (!invited) throw new APIError("FORBIDDEN", { message: "SIGNUP_CLOSED" });
}

/** A user whose every business is locked or past its paid date cannot sign in (provider admins can). */
async function guardLocked(email: string) {
  const user = await db.collection("user").findOne({ email }, { projection: { _id: 1 } });
  if (!user) return;
  const subs = await db
    .collection("member")
    .aggregate<{ sub?: { status?: string; paidUntil?: Date | null } }>([
      { $match: { userId: user._id } },
      { $lookup: { from: "subscriptions", localField: "organizationId", foreignField: "orgId", as: "sub", pipeline: [{ $project: { status: 1, paidUntil: 1 } }] } },
      { $project: { sub: { $first: "$sub" } } },
    ])
    .toArray();
  if (subs.length && subs.every((m) => lockReason(m.sub)) && !(await ProviderAdmin.exists({ userId: String(user._id) }))) {
    throw new APIError("FORBIDDEN", { message: "SUBSCRIPTION_LOCKED" });
  }
}
