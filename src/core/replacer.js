import fs from "fs-extra";
import path from "path";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImportLine(framework, isClient) {
  if (framework === "react") {
    return `import { useTranslation } from 'react-i18next';\n`;
  }
  return isClient
    ? `import { useTranslations } from 'next-intl';\n`
    : `import { getTranslations } from 'next-intl/server';\n`;
}

function getHookLine(framework, isClient) {
  if (framework === "react") {
    return `\n  const { t } = useTranslation();`;
  }
  return isClient
    ? `\n  const t = useTranslations();`
    : `\n  const t = await getTranslations();`;
}

function alreadyHasImport(content, framework) {
  if (framework === "react") return content.includes("useTranslation");
  return content.includes("useTranslations") || content.includes("getTranslations");
}

function addImport(content, isClient, framework) {
  if (alreadyHasImport(content, framework)) return content;

  const importLine = getImportLine(framework, isClient);

  // Insert after "use client" directive if present
  const clientMatch = content.match(/^(['"]use client['"]);?\n/);
  if (clientMatch) {
    return content.slice(0, clientMatch[0].length) + importLine + content.slice(clientMatch[0].length);
  }
  return importLine + content;
}

function addHookDeclaration(content, isClient, framework) {
  const hookLine = getHookLine(framework, isClient);

  if (content.includes("const t =") || content.includes("const { t }")) return content;

  // Pattern 1: export function / export default function
  const fnRegex = /export\s+(?:default\s+)?(?:async\s+)?function\s+\w*\s*\([^{}]*\)\s*(?::\s*[\w<>\[\]|&. ]+\s*)?\{/g;
  // Pattern 2: export const Foo = () => {  or  export const Foo = async () => {
  const arrowRegex = /export\s+const\s+\w+\s*(?::\s*[\w<>.[\] |&]+)?\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[\w<>[\]|&. ]+)?\s*=>\s*\{/g;

  let result = content;
  let offset = 0;
  let injected = false;

  // Collect all matches from both patterns, sorted by position
  const matches = [];
  let m;
  while ((m = fnRegex.exec(content)) !== null) matches.push(m);
  while ((m = arrowRegex.exec(content)) !== null) matches.push(m);
  matches.sort((a, b) => a.index - b.index);

  for (const match of matches) {
    if (injected) break;

    // Server components need async function for await getTranslations()
    if (!isClient && framework === "nextjs" && match[0].includes("function")) {
      const fnDecl = match[0];
      if (!fnDecl.includes("async ")) {
        const asyncFnDecl = fnDecl.replace(
          /^(export\s+(?:default\s+)?)function/,
          "$1async function"
        );
        result = result.slice(0, match.index + offset) + asyncFnDecl + result.slice(match.index + match[0].length + offset);
        offset += asyncFnDecl.length - fnDecl.length;
      }
    }

    const insertAt = match.index + match[0].length + offset;
    result = result.slice(0, insertAt) + hookLine + result.slice(insertAt);
    offset += hookLine.length;
    injected = true;
  }

  return result;
}

export async function replaceStringsInFiles(allStrings, stringMap, cwd, framework = "nextjs") {
  // Group strings by file
  const byFile = new Map();
  for (const str of allStrings) {
    const key = stringMap[str.text];
    if (!key) continue;
    const absPath = path.join(cwd, str.file);
    if (!byFile.has(absPath)) byFile.set(absPath, []);
    byFile.get(absPath).push({ ...str, key });
  }

  const modifiedFiles = [];

  for (const [absPath, strings] of byFile) {
    if (!(await fs.pathExists(absPath))) continue;

    let content;
    try {
      content = await fs.readFile(absPath, "utf-8");
    } catch {
      continue;
    }
    const original = content;
    const isClient =
      content.includes('"use client"') || content.includes("'use client'");

    for (const { text, key, type } of strings) {
      const esc = escapeRegex(text);

      if (type === "jsx_text") {
        // Replace: >  Hello World  <  →  >{t('key')}<
        const regex = new RegExp(`(>\\s*)${esc}(\\s*<)`, "g");
        content = content.replace(regex, `$1{t('${key}')}$2`);
      } else if (type === "attribute") {
        // Replace: placeholder="text" → placeholder={t('key')}
        const attrRegex = new RegExp(
          `((?:placeholder|title|alt|aria-label|aria-description|label|tooltip|description|helperText)=)"${esc}"`,
          "g"
        );
        content = content.replace(attrRegex, `$1{t('${key}')}`);
      }
    }

    if (content !== original) {
      content = addImport(content, isClient, framework);
      content = addHookDeclaration(content, isClient, framework);
      await fs.writeFile(absPath, content, "utf-8");
      modifiedFiles.push(absPath);
    }
  }

  return modifiedFiles;
}
