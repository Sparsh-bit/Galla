import "server-only";

export interface SubscriptionLike {
  status?: string | null;
  paidUntil?: Date | string | null;
}

/** Why a business may not be used right now, or null if it may. No subscription document = active. */
export function lockReason(sub: SubscriptionLike | null | undefined, now = Date.now()): "locked" | "expired" | null {
  if (!sub) return null;
  if (sub.status === "locked") return "locked";
  if (sub.paidUntil && new Date(sub.paidUntil).getTime() < now) return "expired";
  return null;
}

export const LOCKED_MESSAGE = "Your Galla subscription has expired or this account is locked. Contact Concilio Solutions to renew.";

/** How long an offline till may keep billing without checking in: 72 hours, never past the paid date. */
export const OFFLINE_LEASE_MS = 72 * 3600_000;
export function offlineLicenseUntil(sub: SubscriptionLike | null | undefined, now = Date.now()) {
  const lease = now + OFFLINE_LEASE_MS;
  const paid = sub?.paidUntil ? new Date(sub.paidUntil).getTime() : Infinity;
  return new Date(Math.min(lease, paid)).toISOString();
}
