import { cosmiconfig } from "cosmiconfig";
import fs from "fs-extra";
import path from "path";

const CONFIG_FILE = ".transloom.json";
const explorer = cosmiconfig("transloom");

export async function loadConfig() {
  const result = await explorer.search();
  return result ? result.config : null;
}

export async function saveConfig(config) {
  const dest = path.join(process.cwd(), CONFIG_FILE);
  await fs.writeJson(dest, config, { spaces: 2 });
  return dest;
}

export async function configExists() {
  const result = await explorer.search();
  return result !== null;
}

export const DEFAULT_CONFIG = {
  apiKey: "",
  languages: ["en"],
  framework: "nextjs",
  outputDir: "public/locales",
  ignore: ["node_modules", "dist", ".next", "build", "coverage", ".git"],
};
