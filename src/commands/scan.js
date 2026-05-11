import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import path from "path";
import { loadConfig } from "../utils/config.js";
import { validateKey, startScan, getScanResults, updateScanStatus } from "../api/client.js";
import { discoverFiles } from "../core/scanner.js";
import { extractStrings } from "../core/extractor.js";
import { writeTranslations } from "../core/writer.js";
import { logger } from "../utils/logger.js";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function scanCommand() {
  const startTime = Date.now();

  logger.blank();
  console.log(chalk.bold.white("  Transloom Scan"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  // ── Step 1: Config check ─────────────────────────────────────────────────
  logger.step(1, 6, "Checking config…");

  const config = await loadConfig();
  if (!config) {
    logger.error("No config found. Run " + chalk.cyan("transloom init") + " first!");
    logger.blank();
    process.exit(1);
  }

  if (!config.apiKey) {
    logger.error("API key missing in .transloom.json");
    process.exit(1);
  }

  const spinner = ora({ text: "Validating API key…", indent: 2 }).start();
  let userData;
  try {
    userData = await validateKey(config.apiKey);
    spinner.succeed(chalk.dim(`Authenticated as ${chalk.white(userData.user.username)}`));
  } catch {
    spinner.fail("Invalid API key. Check your dashboard.");
    logger.blank();
    process.exit(1);
  }

  // Usage limit check
  if (
    userData.usage &&
    userData.usage.scans_limit !== -1 &&
    userData.usage.scans_used >= userData.usage.scans_limit
  ) {
    logger.error(`Scan limit reached (${userData.usage.scans_used}/${userData.usage.scans_limit}). Upgrade your plan.`);
    process.exit(1);
  }

  logger.blank();

  // ── Step 2: File discovery ────────────────────────────────────────────────
  logger.step(2, 6, "Scanning files…");
  const fileSpinner = ora({ text: "Discovering files…", indent: 2 }).start();

  const cwd = process.cwd();
  const files = await discoverFiles(cwd, config.ignore || []);

  if (files.length === 0) {
    fileSpinner.fail("No .js/.jsx/.ts/.tsx files found.");
    process.exit(1);
  }

  fileSpinner.succeed(chalk.dim(`Found ${chalk.white(files.length)} files`));
  logger.blank();

  // ── Step 3: String extraction ─────────────────────────────────────────────
  logger.step(3, 6, "Extracting hardcoded strings…");
  const extractSpinner = ora({ text: "Parsing AST…", indent: 2 }).start();

  const allStrings = [];
  let parsed = 0;

  for (const file of files) {
    const strings = await extractStrings(file);
    // Make paths relative so user code paths aren't sent as absolute
    const relFile = path.relative(cwd, file);
    allStrings.push(...strings.map((s) => ({ ...s, file: relFile })));
    parsed++;
    if (parsed % 10 === 0) {
      extractSpinner.text = chalk.dim(`  Parsing… ${parsed}/${files.length} files`);
    }
  }

  if (allStrings.length === 0) {
    extractSpinner.succeed(chalk.green("No hardcoded strings found! Your app is already i18n-ready 🎉"));
    logger.blank();
    process.exit(0);
  }

  extractSpinner.succeed(
    chalk.dim(`Found ${chalk.white(allStrings.length)} hardcoded strings across ${chalk.white(files.length)} files`)
  );
  logger.blank();

  // ── Step 4: Send to backend ───────────────────────────────────────────────
  logger.step(4, 6, "Sending to Transloom…");
  const sendSpinner = ora({ text: "Uploading strings…", indent: 2 }).start();

  // Detect repo name from package.json or folder name
  let repoName = path.basename(cwd);
  try {
    const { createRequire } = await import("module");
    const pkgPath = path.join(cwd, "package.json");
    const { default: fse } = await import("fs-extra");
    if (await fse.pathExists(pkgPath)) {
      const pkg = await fse.readJson(pkgPath);
      if (pkg.name) repoName = pkg.name;
    }
  } catch { /* ignore */ }

  let scanId;
  try {
    const result = await startScan(config.apiKey, {
      repo: repoName,
      languages: config.languages,
      framework: config.framework || "nextjs",
      strings: allStrings,
    });
    scanId = result.scan_id;
    sendSpinner.succeed(chalk.dim(`Scan started — ID: ${chalk.white(scanId)}`));
  } catch (err) {
    sendSpinner.fail(`Server error: ${err.response?.data?.detail || err.message}`);
    process.exit(1);
  }

  logger.blank();

  // ── Step 5: Poll for results ──────────────────────────────────────────────
  logger.step(5, 6, "AI is translating…");
  const pollSpinner = ora({ text: "Waiting for translations…", indent: 2 }).start();

  let results;
  const pollDeadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < pollDeadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      results = await getScanResults(config.apiKey, scanId);
    } catch {
      continue;
    }

    if (results.status === "completed") {
      pollSpinner.succeed(chalk.dim("Translations ready!"));
      break;
    }
    if (results.status === "failed") {
      pollSpinner.fail(`Translation failed: ${results.error || "Unknown error"}`);
      process.exit(1);
    }

    pollSpinner.text = chalk.dim(`  AI is working… (${Math.round((Date.now() - startTime) / 1000)}s)`);
  }

  if (!results || results.status !== "completed") {
    pollSpinner.fail("Timed out. Check your dashboard for results.");
    process.exit(1);
  }

  logger.blank();

  // ── Step 6: Write files ───────────────────────────────────────────────────
  logger.step(6, 6, "Writing translation files…");
  const writeSpinner = ora({ text: "Writing files…", indent: 2 }).start();

  const outputDir = path.join(cwd, config.outputDir);
  let writtenFiles = [];

  try {
    writtenFiles = await writeTranslations(outputDir, results.translations);
    await updateScanStatus(config.apiKey, scanId, "files_written");
    writeSpinner.succeed(chalk.dim(`Wrote ${chalk.white(writtenFiles.length)} files`));
  } catch (err) {
    writeSpinner.fail(`Failed to write files: ${err.message}`);
    process.exit(1);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.blank();

  const table = new Table({
    chars: {
      top: "─", "top-mid": "─", "top-left": "┌", "top-right": "┐",
      bottom: "─", "bottom-mid": "─", "bottom-left": "└", "bottom-right": "┘",
      left: "│", "left-mid": "│", mid: "─", "mid-mid": "─",
      right: "│", "right-mid": "│", middle: " ",
    },
    style: { head: [], border: ["dim"] },
  });

  table.push(
    [{ colSpan: 2, content: chalk.bold.green(" ✅ Transloom Scan Complete!") }],
    [chalk.dim(" 📁 Files scanned"), chalk.white(files.length)],
    [chalk.dim(" 📝 Strings found"), chalk.white(allStrings.length)],
    [chalk.dim(" 🌍 Languages"), chalk.white(config.languages.join(", "))],
    [chalk.dim(" ⏱️  Time taken"), chalk.white(`${elapsed}s`)],
  );

  if (writtenFiles.length) {
    table.push([
      chalk.dim(" 📦 Files written"),
      chalk.white(writtenFiles.map((f) => path.relative(cwd, f)).join("\n")),
    ]);
  }

  if (results.pr_url) {
    table.push([chalk.dim(" 🚀 GitHub PR"), chalk.cyan(results.pr_url)]);
  }

  console.log(table.toString());
  logger.blank();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
