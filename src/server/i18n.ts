import "server-only";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, makeT, type Lang } from "@/lib/i18n";

/** The language this person picked (cookie), English by default. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  return makeT(await getLang());
}
