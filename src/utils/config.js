import fs from "fs-extra";
import path from "path";

const CONFIG_FILE = ".transloom.json";

function getConfigPath() {
  return path.join(process.cwd(), CONFIG_FILE);
}

export async function loadConfig() {
  const dest = getConfigPath();
  if (!(await fs.pathExists(dest))) return null;
  return fs.readJson(dest);
}

export async function saveConfig(config) {
  const dest = getConfigPath();
  await fs.writeJson(dest, config, { spaces: 2 });
  return dest;
}

export async function configExists() {
  return fs.pathExists(getConfigPath());
}

export const DEFAULT_CONFIG = {
  apiKey: "",
  languages: ["en"],
  framework: "nextjs",
  outputDir: "public/locales",
  namespace: false,
  ignore: ["node_modules", "dist", ".next", "build", "coverage", ".git", "components/ui"],
};
