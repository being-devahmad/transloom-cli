import fs from "fs-extra";
import path from "path";

function buildRequestConfig(languages) {
  return `import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const locales = [${languages.map((l) => `"${l}"`).join(", ")}];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value;
  const resolved = locale && locales.includes(locale) ? locale : "${languages[0]}";

  return {
    locale: resolved,
    messages: (await import(\`../public/locales/\${resolved}.json\`)).default,
  };
});
`;
}

function buildNextConfig() {
  return `import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withNextIntl(nextConfig);
`;
}

function buildLanguageSelector(languages) {
  const localeList = languages
    .map((l) => `  { code: "${l}", label: "${l.toUpperCase()}" }`)
    .join(",\n");

  return `"use client";

import { useLocale } from "next-intl";

const LOCALES = [
${localeList},
];

export default function LanguageSelector() {
  const locale = useLocale();

  const switchLocale = (code: string) => {
    document.cookie = \`NEXT_LOCALE=\${code}; path=/; max-age=31536000\`;
    window.location.reload();
  };

  return (
    <div style={{ display: "flex", gap: "4px", padding: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
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
}

// Find header/navbar component and inject LanguageSelector into it
async function injectSelectorIntoHeader(cwd, selectorImportPath) {
  const candidates = [
    "components/header.tsx", "components/Header.tsx",
    "components/navbar.tsx", "components/Navbar.tsx",
    "components/nav.tsx",    "components/Nav.tsx",
    "components/navigation.tsx",
    "app/components/header.tsx", "app/components/navbar.tsx",
  ];

  for (const rel of candidates) {
    const filePath = path.join(cwd, rel);
    if (!(await fs.pathExists(filePath))) continue;

    let content = await fs.readFile(filePath, "utf-8");

    // Skip if already imported
    if (content.includes("LanguageSelector")) return rel;

    // Add import after last existing import line
    const lastImport = [...content.matchAll(/^import .+/gm)].pop();
    if (!lastImport) continue;

    const importLine = `import LanguageSelector from '${selectorImportPath}';\n`;
    const insertAt = lastImport.index + lastImport[0].length + 1;
    content = content.slice(0, insertAt) + importLine + content.slice(insertAt);

    // Inject <LanguageSelector /> before first </nav>, </header>, or </div> in the return
    const injected = content.replace(
      /(<\/(?:nav|header)>)/,
      `  <LanguageSelector />\n          $1`
    );

    if (injected !== content) {
      await fs.writeFile(filePath, injected, "utf-8");
      return rel;
    }
  }

  return null;
}

// Update next.config.mjs to add withNextIntl plugin
async function patchNextConfig(cwd) {
  const configPath = path.join(cwd, "next.config.mjs");
  if (!(await fs.pathExists(configPath))) {
    await fs.writeFile(configPath, buildNextConfig());
    return true;
  }

  const content = await fs.readFile(configPath, "utf-8");
  if (content.includes("next-intl/plugin") || content.includes("withNextIntl")) return false;

  const patched =
    `import createNextIntlPlugin from "next-intl/plugin";\nconst withNextIntl = createNextIntlPlugin("./i18n/request.ts");\n\n` +
    content.replace(/export default (\w+);/, "export default withNextIntl($1);");

  await fs.writeFile(configPath, patched, "utf-8");
  return true;
}

export async function setupNextIntl(cwd, languages, createSelector = true) {
  const created = [];

  const isAppRouter = await fs.pathExists(path.join(cwd, "app"));
  const componentsDir = isAppRouter
    ? path.join(cwd, "app", "components")
    : path.join(cwd, "src", "components");

  // i18n/request.ts
  const requestFile = path.join(cwd, "i18n", "request.ts");
  if (!(await fs.pathExists(requestFile))) {
    await fs.ensureDir(path.join(cwd, "i18n"));
    await fs.writeFile(requestFile, buildRequestConfig(languages));
    created.push("i18n/request.ts");
  }

  // next.config.mjs — add withNextIntl plugin
  const patched = await patchNextConfig(cwd);
  if (patched) created.push("next.config.mjs (withNextIntl added)");

  // LanguageSelector.tsx
  if (createSelector) {
    const selectorFile = path.join(componentsDir, "LanguageSelector.tsx");
    if (!(await fs.pathExists(selectorFile))) {
      await fs.ensureDir(componentsDir);
      await fs.writeFile(selectorFile, buildLanguageSelector(languages));
      created.push(path.relative(cwd, selectorFile));
    }

    // Auto-inject into header/navbar
    const relSelector = path.relative(cwd, path.join(componentsDir, "LanguageSelector")).replace(/\\/g, "/");
    const selectorImport = "@/" + relSelector;
    const injectedInto = await injectSelectorIntoHeader(cwd, selectorImport);
    if (injectedInto) created.push(`LanguageSelector injected into ${injectedInto}`);
  }

  return created;
}
