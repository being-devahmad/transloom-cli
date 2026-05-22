import fs from "fs-extra";
import path from "path";

const I18N_TS = `"use client";

import { createContext, useContext } from "react";

export type Messages = Record<string, unknown>;
export type TranslateFn = (key: string) => string;

function resolve(messages: Messages, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

export const I18nContext = createContext<{
  locale: string;
  messages: Messages;
  setLocale: (code: string) => void;
}>({ locale: "en", messages: {}, setLocale: () => {} });

export function useTranslations(): TranslateFn {
  const { messages } = useContext(I18nContext);
  return (key: string) => resolve(messages, key);
}

export function useLocale() {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}
`;

function buildProvider(languages) {
  const imports = languages
    .map((l) => `import ${l}Messages from "../../public/locales/${l}.json";`)
    .join("\n");

  const localeList = languages
    .map((l) => `  { code: "${l}", label: "${l.toUpperCase()}" }`)
    .join(",\n");

  const messagesMap = languages
    .map((l) => `  ${l}: ${l}Messages as Messages,`)
    .join("\n");

  return `"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { I18nContext, type Messages } from "./i18n";
${imports}

const LOCALE_KEY = "tl_locale";

export const SUPPORTED_LOCALES = [
${localeList}
];

const ALL_MESSAGES: Record<string, Messages> = {
${messagesMap}
};

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState("${languages[0]}");

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && ALL_MESSAGES[saved]) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((code: string) => {
    if (!ALL_MESSAGES[code]) return;
    localStorage.setItem(LOCALE_KEY, code);
    setLocaleState(code);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, messages: ALL_MESSAGES[locale] ?? ALL_MESSAGES["${languages[0]}"], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
`;
}

const LANGUAGE_SELECTOR = `"use client";

import { useLocale } from "../lib/i18n";
import { SUPPORTED_LOCALES } from "../lib/I18nProvider";

export default function LanguageSelector() {
  const { locale, setLocale } = useLocale();

  return (
    <div style={{ display: "flex", gap: "4px", padding: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
      {SUPPORTED_LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: locale === code ? "#7c3aed" : "transparent",
            color: locale === code ? "#fff" : "#94a3b8",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
`;

export async function setupI18n(cwd, languages, createSelector = true) {
  const libDir = path.join(cwd, "src", "lib");
  const appLibDir = path.join(cwd, "app", "lib");
  const componentsDir = path.join(cwd, "src", "components");
  const appComponentsDir = path.join(cwd, "app", "components");

  // Detect if it's a Next.js app router or src-based project
  const isAppRouter = await fs.pathExists(path.join(cwd, "app"));
  const targetLib = isAppRouter ? appLibDir : libDir;
  const targetComponents = isAppRouter ? appComponentsDir : componentsDir;

  const i18nFile = path.join(targetLib, "i18n.ts");
  const providerFile = path.join(targetLib, "I18nProvider.tsx");
  const selectorFile = path.join(targetComponents, "LanguageSelector.tsx");

  const created = [];

  if (!(await fs.pathExists(i18nFile))) {
    await fs.ensureDir(targetLib);
    await fs.writeFile(i18nFile, I18N_TS);
    created.push(path.relative(cwd, i18nFile));
  }

  if (!(await fs.pathExists(providerFile))) {
    await fs.ensureDir(targetLib);
    await fs.writeFile(providerFile, buildProvider(languages));
    created.push(path.relative(cwd, providerFile));
  }

  if (createSelector && !(await fs.pathExists(selectorFile))) {
    await fs.ensureDir(targetComponents);
    await fs.writeFile(selectorFile, LANGUAGE_SELECTOR);
    created.push(path.relative(cwd, selectorFile));
  }

  return created;
}
