import fs from "fs-extra";
import path from "path";

export async function writeTranslations(outputDir, translations) {
  await fs.ensureDir(outputDir);

  const writtenFiles = [];

  for (const [lang, strings] of Object.entries(translations)) {
    const filePath = path.join(outputDir, `${lang}.json`);
    await fs.writeJson(filePath, strings, { spaces: 2 });
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}
