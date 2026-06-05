import fs from "fs-extra";
import path from "path";

function buildI18nConfig(languages, outputDir) {
  const imports = languages
    .map((l) => `import ${l}Messages from "../${outputDir}/${l}.json";`)
    .join("\n");

  const resources = languages
    .map((l) => `    ${l}: { translation: ${l}Messages },`)
    .join("\n");

  return `import i18n from "i18next";
import { initReactI18next } from "react-i18next";
${imports}

i18n.use(initReactI18next).init({
  lng: "${languages[0]}",
  fallbackLng: "${languages[0]}",
  resources: {
${resources}
  },
  interpolation: { escapeValue: false },
});

export default i18n;
`;
}

function buildI18nProvider() {
  return `import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { ReactNode } from "react";

export default function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
`;
}

function buildLanguageSelector(languages) {
  const localeList = languages
    .map((l) => `  { code: "${l}", label: "${l.toUpperCase()}" }`)
    .join(",\n");

  return `"use client";

import { useTranslation } from "react-i18next";

const LOCALES = [
${localeList},
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div style={{ display: "flex", gap: "4px", padding: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: i18n.language === code ? "#7c3aed" : "transparent",
            color: i18n.language === code ? "#fff" : "#94a3b8",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
`;
}

// Inject I18nProvider into main.tsx / main.jsx entry point
async function injectProviderIntoEntry(cwd, baseDir, providerFile) {
  const candidates = [
    path.join(baseDir, "main.tsx"),
    path.join(baseDir, "main.jsx"),
    path.join(cwd, "src", "main.tsx"),
    path.join(cwd, "src", "main.jsx"),
    path.join(cwd, "main.tsx"),
    path.join(cwd, "main.jsx"),
  ];

  for (const entryPath of candidates) {
    if (!(await fs.pathExists(entryPath))) continue;

    let content = await fs.readFile(entryPath, "utf-8");

    // Skip if already wrapped
    if (content.includes("I18nProvider")) return path.relative(cwd, entryPath);

    // Build relative import path from entry file to provider file
    const relProvider = path
      .relative(path.dirname(entryPath), providerFile)
      .replace(/\\/g, "/")
      .replace(/\.(tsx|ts|jsx|js)$/, "");
    const importPrefix = relProvider.startsWith(".") ? relProvider : `./${relProvider}`;

    // Add import after last existing import line
    const lastImport = [...content.matchAll(/^import .+/gm)].pop();
    if (!lastImport) continue;

    const importLine = `import I18nProvider from '${importPrefix}';\n`;
    const insertAt = lastImport.index + lastImport[0].length + 1;
    content = content.slice(0, insertAt) + importLine + content.slice(insertAt);

    // Wrap <App /> with <I18nProvider>
    // Handles: <App />, <App/>, <StrictMode><App /></StrictMode>
    content = content.replace(
      /(<React\.StrictMode>)([\s\S]*?)(<\/React\.StrictMode>)/,
      (_, open, inner, close) =>
        `${open}\n      <I18nProvider>${inner.trim()}</I18nProvider>\n    ${close}`
    );

    // Fallback: no StrictMode — wrap <App /> directly
    if (!content.includes("I18nProvider>")) {
      content = content.replace(/<App\s*\/>/, `<I18nProvider>\n        <App />\n      </I18nProvider>`);
    }

    await fs.writeFile(entryPath, content, "utf-8");
    return path.relative(cwd, entryPath);
  }

  return null;
}

export async function setupI18next(cwd, languages, createSelector = true, outputDir = "public/locales") {
  const created = [];

  const srcDir = path.join(cwd, "src");
  const hasSrc = await fs.pathExists(srcDir);
  const baseDir = hasSrc ? srcDir : cwd;
  const componentsDir = path.join(baseDir, "components");

  // src/i18n.ts
  const i18nFile = path.join(baseDir, "i18n.ts");
  if (!(await fs.pathExists(i18nFile))) {
    await fs.ensureDir(baseDir);
    await fs.writeFile(i18nFile, buildI18nConfig(languages, outputDir));
    created.push(path.relative(cwd, i18nFile));
  }

  // src/I18nProvider.tsx
  const providerFile = path.join(baseDir, "I18nProvider.tsx");
  if (!(await fs.pathExists(providerFile))) {
    await fs.ensureDir(baseDir);
    await fs.writeFile(providerFile, buildI18nProvider());
    created.push(path.relative(cwd, providerFile));
  }

  // Inject I18nProvider into entry point (main.tsx / main.jsx)
  const injectedEntry = await injectProviderIntoEntry(cwd, baseDir, providerFile);
  if (injectedEntry) created.push(`I18nProvider injected into ${injectedEntry}`);

  // src/components/LanguageSelector.tsx
  if (createSelector) {
    const selectorFile = path.join(componentsDir, "LanguageSelector.tsx");
    if (!(await fs.pathExists(selectorFile))) {
      await fs.ensureDir(componentsDir);
      await fs.writeFile(selectorFile, buildLanguageSelector(languages));
      created.push(path.relative(cwd, selectorFile));
    }
  }

  return created;
}
