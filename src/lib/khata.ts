// Khata (ledger) wording shared by the web and the Android app.
export const KHATA_LABELS: Record<"customer" | "supplier", Record<string, string>> = {
  customer: { plus: "Udhaar / bills", minus: "Received", opening: "Opening balance", sale: "Bill on account", sale_void: "Bill voided", return: "Return credited", payment: "Payment received", udhaar: "Udhaar given", adjustment: "Adjustment", reversal: "Correction (undo)" },
  supplier: { plus: "Purchases", minus: "Paid", opening: "Opening balance", purchase: "Goods received", purchase_return: "Returned to supplier", payment: "Payment made", udhaar: "Udhaar taken", adjustment: "Adjustment", reversal: "Correction (undo)" },
};

/** WhatsApp payment reminder for a customer's pending balance (`amount` already formatted). */
export const reminderText = (name: string, business: string, amount: string) =>
  `Namaste ${name}, this is a reminder from ${business}. Your pending balance is ${amount}. Please pay at your earliest convenience. Thank you!`;
