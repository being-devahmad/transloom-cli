import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import { loadConfig } from "../utils/config.js";
import { validateKey } from "../api/client.js";
import { logger } from "../utils/logger.js";

const VALID_FRAMEWORKS = ["nextjs", "react"];

export async function validateCommand() {
  logger.blank();
  console.log(chalk.bold.white("  Transloom Validate"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  const cwd = process.cwd();
  let passed = 0;
  let failed = 0;

  function ok(msg) {
    console.log(`  ${chalk.green("✔")} ${chalk.dim(msg)}`);
    passed++;
  }

  function fail(msg) {
    console.log(`  ${chalk.red("✘")} ${chalk.white(msg)}`);
    failed++;
  }

  function warn(msg) {
    console.log(`  ${chalk.yellow("⚠")} ${chalk.dim(msg)}`);
  }

  // ── Check 1: Config file exists ───────────────────────────────────────────
  const config = await loadConfig();
  if (!config) {
    fail(".transloom.json not found — run transloom init first");
    logger.blank();
    console.log(chalk.red(`  0 passed, 1 failed`));
    logger.blank();
    return;
  }
  ok(".transloom.json found");

  // ── Check 2: API key present and format valid ─────────────────────────────
  if (!config.apiKey) {
    fail("API key missing in config");
  } else if (!config.apiKey.startsWith("tl_")) {
    fail(`API key format invalid — must start with "tl_"`);
  } else {
    ok("API key format valid");
  }

  // ── Check 3: API key works (call backend) ─────────────────────────────────
  if (config.apiKey && config.apiKey.startsWith("tl_")) {
    const spinner = ora({ text: "Verifying API key with server…", indent: 2 }).start();
    try {
      const result = await validateKey(config.apiKey);
      spinner.stop();
      ok(`API key authenticated as ${chalk.white(result.user.username)}`);

      if (result.usage) {
        const { scans_used, scans_limit } = result.usage;
        const limitStr = scans_limit === -1 ? "∞" : String(scans_limit);
        if (scans_limit !== -1 && scans_used >= scans_limit) {
          warn(`Scan limit reached (${scans_used}/${limitStr}) — upgrade your plan`);
        } else {
          ok(`Usage: ${scans_used}/${limitStr} scans`);
        }
      }
    } catch {
      spinner.stop();
      fail("API key is invalid or server unreachable");
    }
  }

  // ── Check 4: Framework valid ──────────────────────────────────────────────
  if (!config.framework) {
    warn('Framework not set — will be asked on next scan');
  } else if (!VALID_FRAMEWORKS.includes(config.framework)) {
    fail(`Unknown framework "${config.framework}" — must be "nextjs" or "react"`);
  } else {
    ok(`Framework: ${chalk.white(config.framework)}`);
  }

  // ── Check 5: Languages configured ────────────────────────────────────────
  if (!config.languages || config.languages.length === 0) {
    fail("No languages configured");
  } else if (!config.languages.includes("en")) {
    fail('Languages must include "en" as base language');
  } else {
    ok(`Languages: ${chalk.white(config.languages.join(", "))}`);
  }

  // ── Check 6: Output directory ─────────────────────────────────────────────
  if (!config.outputDir) {
    fail("outputDir missing in config");
  } else {
    ok(`Output dir: ${chalk.white(config.outputDir)}`);
  }

  // ── Check 7: package.json exists (valid JS project) ──────────────────────
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fs.pathExists(pkgPath))) {
    fail("No package.json found — run this inside a JS/TS project");
  } else {
    ok("package.json found");

    // Check if i18n package installed
    try {
      const pkg = await fs.readJson(pkgPath);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const expectedPkg = config.framework === "react" ? "i18next" : "next-intl";
      if (deps[expectedPkg]) {
        ok(`${expectedPkg} installed (${deps[expectedPkg]})`);
      } else {
        warn(`${expectedPkg} not installed — run transloom scan to install`);
      }
    } catch { /* ignore */ }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  logger.blank();
  if (failed === 0) {
    console.log(chalk.green(`  ✅ All checks passed (${passed}/${passed + failed})`));
  } else {
    console.log(chalk.red(`  ❌ ${failed} check(s) failed`) + chalk.dim(` — ${passed} passed`));
  }
  logger.blank();
}
