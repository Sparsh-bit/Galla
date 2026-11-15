/**
 * Guardrails for Ask Galla. It is a shop assistant: it answers about the shop's own numbers and how to use Galla
 * (and ordinary shop, stock, billing, GST and accounting questions). It is not a general chatbot: no programming
 * help, no attempts to bend its rules, nothing that leaks its instructions or keys. Three layers: this check
 * before the model is asked, strict instructions to the model, and a check of what it answers.
 */

export const REFUSAL =
  "I can only help with your shop and the Galla app: sales, stock, bills, udhaar, GST, customers and suppliers, and how to do things in Galla. Please ask me something about your business.";

// Product codes, barcodes and promo codes are shop words, not programming.
const SHOP_CODE = /\b(product|bar|qr|item|promo|coupon|discount|hsn|sku|pin|post|area|country|state|short)\s*-?codes?\b|\bcodes?\s+(number|no\b)/gi;

const OFF_TOPIC: RegExp[] = [
  // asking for programs / scripts in any language
  /\b(python|java|javascript|typescript|node\.?js|c\+\+|c#|golang|rust|php|ruby|kotlin|swift|html|css|sql|bash|shell|powershell|react|django|flask|regex)\b/i,
  /\b(write|give|show|create|generate|make|build|code|likh(o|na)?|bana(o|na)?)\b.{0,40}\b(code|program|script|function|algorithm|class|snippet|bot|website|malware|virus|exploit|keylogger|ransomware)\b/i,
  /\b(linked ?list|binary tree|hash ?map|stack and queue|sorting algorithm|bubble sort|leetcode|data structure|recursion|fibonacci)\b/i,
  // trying to change the rules or see them
  /\bignore (all |any |the |your )?(previous|prior|above|earlier)\b/i,
  /\b(system|hidden|secret|initial) (prompt|instructions?|message)\b/i,
  /\b(reveal|show|print|repeat|leak|tell me) (your |the )?(instructions|prompt|rules|api key|key|token|password|secret)\b/i,
  /\b(jailbreak|developer mode|do anything now|pretend (to be|you are)|act as (an? )?(unrestricted|evil|hacker))\b/i,
  // security attacks
  /\b(hack|crack|bypass|exploit|inject(ion)?|phish(ing)?|steal|brute ?force|ddos|sql injection|xss)\b/i,
  // not about a shop
  /\b(poem|poetry|essay|short story|song lyrics|lyrics|joke|riddle|horoscope|homework|assignment|thesis)\b/i,
  /\b(who (is|was) the (prime minister|president)|election|cricket score|movie review|recipe for|weather in)\b/i,
];

/** A short reason if the message is clearly not for a shop assistant, otherwise null. */
export function offTopicReason(message: string): string | null {
  const text = message.replace(SHOP_CODE, " ").slice(0, 2000);
  return OFF_TOPIC.some((r) => r.test(text)) ? REFUSAL : null;
}

const CODE_SIGNS: RegExp[] = [
  /```/,
  /^\s*(def|class|import|from|function|const|let|var|public|private|#include|SELECT|INSERT|UPDATE)\b.*[:{;(]\s*$/m,
  /^\s*(for|while|if)\s*\(.*\)\s*\{?\s*$/m,
  /\bself\.(next|head|data)\b|\bNode\(/,
];

/** True if a model answer looks like source code, or leaks keys or its own instructions. */
export function badAnswer(reply: string): boolean {
  if (CODE_SIGNS.some((r) => r.test(reply))) return true;
  if (/\b(gsk_|sk-ant-|sk-proj-)[A-Za-z0-9_-]{8,}/.test(reply)) return true;
  if (/LIVE DATA \(JSON|You are Galla Assistant|Rules:\s*\n-/i.test(reply)) return true;
  return false;
}
