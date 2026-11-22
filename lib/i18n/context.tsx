"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import frMessages from "@/messages/fr.json";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

export type Locale = "fr" | "ar" | "en";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  t: (key: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<Locale, Record<string, any>> = {
  fr: frMessages,
  ar: arMessages,
  en: enMessages,
};

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    // Read from cookie or localStorage
    const savedLocale = (localStorage.getItem("uec_locale") ||
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("uec_locale="))
        ?.split("=")[1]) as Locale | undefined;

    if (savedLocale && ["fr", "ar", "en"].includes(savedLocale)) {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("uec_locale", newLocale);
    document.cookie = `uec_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const t = (path: string, params?: Record<string, string | number>): string => {
    const primary = dictionaries[locale];
    const fallback = dictionaries.fr;

    let text = getNestedValue(primary, path) ?? getNestedValue(fallback, path) ?? path;

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        text = text.replace(new RegExp(`{${key}}`, "g"), String(val));
      });
    }

    return text;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, dir, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
