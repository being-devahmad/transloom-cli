import fs from "fs-extra";
import path from "path";

const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export async function discoverFiles(rootDir, ignoreList = []) {
  const ignored = new Set(ignoreList);
  const files = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      if (ignored.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(rootDir);
  return files;
}
