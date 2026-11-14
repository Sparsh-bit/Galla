/** Concilio Solutions LLP: how to reach us, and what Galla costs. Prices are per shop, before 18% GST. */
export const CONTACT = {
  company: "Concilio Solutions LLP",
  email: "team@concilio.solutions",
  phone: "+91 99568 46866",
  whatsapp: "https://wa.me/919956846866?text=Hi%20Concilio%2C%20I%20want%20to%20see%20Galla",
  instagram: "https://instagram.com/concilio.official",
  instagramHandle: "@concilio.official",
  site: "https://concilio.solutions",
  replyWithin: "12 hours",
} as const;

export interface Plan {
  id: "dukaan" | "vyapaar" | "business";
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "dukaan", name: "Dukaan", tagline: "One counter, owner-run shop", monthly: 499, yearly: 4990,
    features: ["1 shop · 1 billing counter", "2 staff logins", "Billing, UPI QR, WhatsApp bills", "Khata with reminders", "Stock, low-stock alerts, reports"],
  },
  {
    id: "vyapaar", name: "Vyapaar", tagline: "Busy shop with staff", monthly: 899, yearly: 8990, popular: true,
    features: ["Everything in Dukaan", "Up to 3 counters · 6 logins", "Offline POS on every counter", "Batches, expiry, purchasing", "Barcode labels, Excel import"],
  },
  {
    id: "business", name: "Business", tagline: "Multi-shop, mobile & distributors", monthly: 1799, yearly: 17990,
    features: ["Everything in Vyapaar", "Up to 3 shops · unlimited counters", "Serial / IMEI tracking", "GST e-invoice + e-way bill", "Audit log, priority support"],
  },
];

/** true = included, false = not in this plan, string = the limit. */
export const COMPARE: { feature: string; values: [boolean | string, boolean | string, boolean | string] }[] = [
  { feature: "Billing, UPI QR, WhatsApp & printed bills", values: [true, true, true] },
  { feature: "Khata with WhatsApp reminders", values: [true, true, true] },
  { feature: "Stock, low-stock alerts, GST reports", values: [true, true, true] },
  { feature: "Billing counters", values: ["1", "3", "Unlimited"] },
  { feature: "Staff logins", values: ["2", "6", "Unlimited"] },
  { feature: "Offline billing with auto-sync", values: [false, true, true] },
  { feature: "Batches & expiry (first-expiry-first-out)", values: [false, true, true] },
  { feature: "Purchase orders & supplier dues", values: [false, true, true] },
  { feature: "Serial / IMEI tracking", values: [false, false, true] },
  { feature: "GST e-invoice (IRN) + e-way bill", values: [false, false, true] },
  { feature: "Multiple shops & stock transfer", values: [false, false, true] },
];

export const ADDONS: { name: string; price: string; note?: string }[] = [
  { name: "Setup + staff training", price: "₹2,999 once", note: "Free on yearly Vyapaar and Business plans" },
  { name: "Extra shop (Business)", price: "₹4,990 / year" },
  { name: "Old data import from Excel", price: "Free" },
  { name: "Scanner + printer", price: "At cost", note: "Optional: any USB/Bluetooth scanner and 58/80 mm printer works, or the phone camera" },
  { name: "Custom features or your own server", price: "From ₹1,25,000" },
];

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
