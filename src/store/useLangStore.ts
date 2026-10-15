"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
import { getT, LANG_STORAGE_KEY } from "@/lib/i18n";

interface LangState {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "ar",
      setLang: (lang) => set({ lang }),
      toggle: () => set({ lang: get().lang === "ar" ? "en" : "ar" }),
      t: (key, vars) => {
        const t = getT(get().lang);
        return t(key, vars);
      },
    }),
    {
      name: LANG_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Apply `dir` and `lang` attributes on <html> whenever the language changes.
// Run this once at app startup.
if (typeof window !== "undefined") {
  useLangStore.subscribe((state) => {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === "ar" ? "rtl" : "ltr";
  });
}
