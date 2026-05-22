import fs from "fs-extra";
import path from "path";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addImport(content, isClient) {
  const importLine = isClient
    ? `import { useTranslations } from '@/app/lib/i18n';\n`
    : `import { getTranslations } from '@/app/lib/i18n-server';\n`;

  if (content.includes("useTranslations") || content.includes("getTranslations")) return content;

  // Insert after "use client" directive if present
  const clientMatch = content.match(/^(['"]use client['"]);?\n/);
  if (clientMatch) {
    return content.slice(0, clientMatch[0].length) + importLine + content.slice(clientMatch[0].length);
  }
  return importLine + content;
}

function addHookDeclaration(content, isClient) {
  const hookLine = isClient
    ? `\n  const t = useTranslations();`
    : `\n  const t = await getTranslations();`;

  if (content.includes("const t =")) return content;

  // Match function body opening: must end with `) {` or `): ReturnType {`
  // Avoid matching destructured params: `function Foo({ ... }) {`
  const fnRegex = /export\s+default\s+(?:async\s+)?function\s+\w*\s*\([^{}]*\)\s*(?::\s*[\w<>\[\]|&]+\s*)?\{/g;
  let match;
  let result = content;
  let offset = 0;

  while ((match = fnRegex.exec(content)) !== null) {
    const insertAt = match.index + match[0].length + offset;
    result = result.slice(0, insertAt) + hookLine + result.slice(insertAt);
    offset += hookLine.length;
  }

  return result;
}

export async function replaceStringsInFiles(allStrings, stringMap, cwd) {
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

    let content = await fs.readFile(absPath, "utf-8");
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
      content = addImport(content, isClient);
      content = addHookDeclaration(content, isClient);
      await fs.writeFile(absPath, content, "utf-8");
      modifiedFiles.push(absPath);
    }
  }

  return modifiedFiles;
}
