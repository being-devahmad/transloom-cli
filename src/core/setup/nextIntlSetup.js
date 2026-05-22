import fs from "fs-extra";
import path from "path";

function buildRequestConfig(languages) {
  return `import { getRequestConfig } from "next-intl/server";

const locales = [${languages.map((l) => `"${l}"`).join(", ")}];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale)) locale = "${languages[0]}";

  return {
    locale,
    messages: (await import(\`../public/locales/\${locale}.json\`)).default,
  };
});
`;
}

function buildMiddleware(languages) {
  return `import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: [${languages.map((l) => `"${l}"`).join(", ")}],
  defaultLocale: "${languages[0]}",
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
`;
}

function buildLanguageSelector(languages) {
  const localeList = languages
    .map((l) => `  { code: "${l}", label: "${l.toUpperCase()}" }`)
    .join(",\n");

  return `"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

const LOCALES = [
${localeList},
];

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: "4px", padding: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => router.replace(pathname, { locale: code })}
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

  // middleware.ts
  const middlewareFile = path.join(cwd, "middleware.ts");
  if (!(await fs.pathExists(middlewareFile))) {
    await fs.writeFile(middlewareFile, buildMiddleware(languages));
    created.push("middleware.ts");
  }

  // LanguageSelector.tsx
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
