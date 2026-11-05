"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LANG_COOKIE, LANGS, makeT, type Lang, type T } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Ctx = createContext<{ lang: Lang; t: T; setLang: (l: Lang) => void }>({ lang: "en", t: makeT("en"), setLang: () => undefined });

export function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, set] = useState<Lang>(initial);
  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      set(l);
      router.refresh(); // server-rendered screens pick up the new language too
    },
    [router],
  );
  const value = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

/** Globe button to switch the language of the whole app. */
export function LanguagePicker({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className} aria-label={t("Language")}>
          <Languages /> <span className="hidden sm:inline">{LANGS.find((l) => l.code === lang)?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("Language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
          {LANGS.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code} lang={l.code}>{l.name}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
