import fs from "fs-extra";
import path from "path";

const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

export async function discoverFiles(rootDir, ignoreList = []) {
  const files = [];

  function isIgnored(fullPath) {
    const rel = path.relative(rootDir, fullPath).replace(/\\/g, "/");
    const segments = rel.split("/");
    return ignoreList.some((pattern) => {
      const normalizedPattern = pattern.replace(/\\/g, "/");
      // Match exact segment (e.g. "node_modules") or path prefix (e.g. "components/ui")
      return (
        segments.includes(normalizedPattern) ||
        rel === normalizedPattern ||
        rel.startsWith(normalizedPattern + "/")
      );
    });
  }

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      if (isIgnored(fullPath)) continue;

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
