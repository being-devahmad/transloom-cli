import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import path from "path";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { loadConfig, saveConfig } from "../utils/config.js";
import {
  validateKey,
  startScan,
  getScanResults,
  updateScanStatus,
} from "../api/client.js";
import { discoverFiles } from "../core/scanner.js";
import { extractStrings } from "../core/extractor.js";
import { writeTranslations } from "../core/writer.js";
import { replaceStringsInFiles } from "../core/replacer.js";
import { setupI18n } from "../core/i18nSetup.js";
import { logger } from "../utils/logger.js";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function scanCommand({ dryRun = false } = {}) {
  const startTime = Date.now();

  logger.blank();
  console.log(chalk.bold.white("  Transloom Scan"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  // ── Step 1: Config check ─────────────────────────────────────────────────
  logger.step(1, 8, "Checking config…");

  const config = await loadConfig();
  if (!config) {
    logger.error(
      "No config found. Run " + chalk.cyan("transloom init") + " first!",
    );
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
    spinner.succeed(
      chalk.dim(`Authenticated as ${chalk.white(userData.user.username)}`),
    );
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
    logger.error(
      `Scan limit reached (${userData.usage.scans_used}/${userData.usage.scans_limit}). Upgrade your plan.`,
    );
    process.exit(1);
  }

  logger.blank();

  // ── Ask: framework? (skip if already saved in config) ───────────────────
  let framework = config.framework;
  if (!framework || (framework !== "nextjs" && framework !== "react")) {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "framework",
        message: "Which library or framework are you using?",
        choices: [
          { name: "Next.js", value: "nextjs" },
          { name: "React.js", value: "react" },
        ],
      },
    ]);
    framework = answer.framework;
    await saveConfig({ ...config, framework });
  }
  logger.blank();

  // ── Step 2: File discovery ────────────────────────────────────────────────
  logger.step(2, 8, "Scanning files…");
  const fileSpinner = ora({ text: "Discovering files…", indent: 2 }).start();

  const cwd = process.cwd();
  const files = await discoverFiles(cwd, config.ignore || []);

  if (files.length === 0) {
    fileSpinner.fail("No .js/.jsx/.ts/.tsx files found.");
    process.exit(1);
  }

  fileSpinner.succeed(chalk.dim(`Found ${chalk.white(files.length)} files`));
  logger.blank();

  // ── Ask: i18n setup? ─────────────────────────────────────────────────────
  const { wantsI18n } = await inquirer.prompt([
    {
      type: "confirm",
      name: "wantsI18n",
      message: "Do you want to set up i18n in your project?",
      default: true,
    },
  ]);
  logger.blank();

  // ── Ask: create GitHub PR? ────────────────────────────────────────────────
  const { wantsPR } = await inquirer.prompt([
    {
      type: "confirm",
      name: "wantsPR",
      message: "Do you want to create a GitHub PR with these changes?",
      default: false,
    },
  ]);
  logger.blank();

  // ── Step 3: String extraction ─────────────────────────────────────────────
  logger.step(3, 8, "Extracting hardcoded strings…");
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
      extractSpinner.text = chalk.dim(
        `  Parsing… ${parsed}/${files.length} files`,
      );
    }
  }

  if (allStrings.length === 0) {
    extractSpinner.succeed(
      chalk.green(
        "No hardcoded strings found! Your app is already i18n-ready 🎉",
      ),
    );
    logger.blank();
    process.exit(0);
  }

  extractSpinner.succeed(
    chalk.dim(
      `Found ${chalk.white(allStrings.length)} hardcoded strings across ${chalk.white(files.length)} files`,
    ),
  );
  logger.blank();

  // ── Dry run: show extracted strings and exit ──────────────────────────────
  if (dryRun) {
    const dryTable = new Table({
      chars: {
        top: "─", "top-mid": "─", "top-left": "┌", "top-right": "┐",
        bottom: "─", "bottom-mid": "─", "bottom-left": "└", "bottom-right": "┘",
        left: "│", "left-mid": "│", mid: "─", "mid-mid": "─",
        right: "│", "right-mid": "│", middle: " ",
      },
      style: { head: [], border: ["dim"] },
    });
    dryTable.push(
      [{ colSpan: 3, content: chalk.bold.yellow("  Dry Run — No files will be changed") }],
      [chalk.dim(" File"), chalk.dim("Line"), chalk.dim("String")],
    );
    for (const s of allStrings.slice(0, 30)) {
      dryTable.push([chalk.dim(s.file), chalk.dim(String(s.line)), chalk.white(s.text.slice(0, 60))]);
    }
    if (allStrings.length > 30) {
      dryTable.push([{ colSpan: 3, content: chalk.dim(`  … and ${allStrings.length - 30} more`) }]);
    }
    console.log(dryTable.toString());
    logger.blank();
    logger.info(`Run without ${chalk.cyan("--dry-run")} to apply translations.`);
    logger.blank();
    process.exit(0);
  }

  // ── Step 4: Send to backend ───────────────────────────────────────────────
  logger.step(4, 8, "Sending to Transloom…");
  const sendSpinner = ora({ text: "Uploading strings…", indent: 2 }).start();

  // Detect repo name from package.json or folder name
  let repoName = path.basename(cwd);
  try {
    const pkgPath = path.join(cwd, "package.json");
    const { default: fse } = await import("fs-extra");
    if (await fse.pathExists(pkgPath)) {
      const pkg = await fse.readJson(pkgPath);
      if (pkg.name) repoName = pkg.name;
    }
  } catch {
    /* ignore */
  }

  let scanId;
  try {
    const result = await startScan(config.apiKey, {
      repo: repoName,
      languages: config.languages,
      framework,
      strings: allStrings,
      create_pr: wantsPR,
    });
    scanId = result.scan_id;
    sendSpinner.succeed(chalk.dim(`Scan started — ID: ${chalk.white(scanId)}`));
  } catch (err) {
    sendSpinner.fail(
      `Server error: ${err.response?.data?.detail || err.message}`,
    );
    process.exit(1);
  }

  logger.blank();

  // ── Step 5: Poll for results ──────────────────────────────────────────────
  logger.step(5, 8, "AI is translating…");
  const pollSpinner = ora({
    text: "Waiting for translations…",
    indent: 2,
  }).start();

  let results;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;
  const pollDeadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < pollDeadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      results = await getScanResults(config.apiKey, scanId);
      consecutiveErrors = 0;
    } catch {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        pollSpinner.fail(chalk.dim(`Server unreachable after ${MAX_CONSECUTIVE_ERRORS} attempts. Scan ID: ${chalk.white(scanId)}`));
        process.exit(1);
      }
      continue;
    }

    if (results.status === "completed") {
      pollSpinner.succeed(chalk.dim("Translations ready!"));
      break;
    }
    if (results.status === "failed") {
      pollSpinner.fail(
        `Translation failed: ${results.error || "Unknown error"}`,
      );
      process.exit(1);
    }

    pollSpinner.text = chalk.dim(
      `  AI is working… (${Math.round((Date.now() - startTime) / 1000)}s)`,
    );
  }

  if (!results || results.status !== "completed") {
    pollSpinner.fail(
      `Timed out waiting for translations. Scan ID: ${chalk.white(scanId)} — check your dashboard.`
    );
    process.exit(1);
  }

  logger.blank();

  // ── Validate backend response ─────────────────────────────────────────────
  if (!results.translations || typeof results.translations !== "object") {
    logger.error("Invalid response from server: translations missing.");
    process.exit(1);
  }
  if (Object.keys(results.translations).length === 0) {
    logger.error("Server returned empty translations. Please try again.");
    process.exit(1);
  }

  // ── Ask: confirm string replacement ──────────────────────────────────────
  let proceedWithReplace = false;
  if (results.string_map && typeof results.string_map === "object" && Object.keys(results.string_map).length > 0) {
    const stringCount = Object.keys(results.string_map).length;
    const fileSet = new Set(allStrings.filter((s) => results.string_map[s.text]).map((s) => s.file));

    logger.blank();
    console.log(chalk.bold.white("  Strings to be replaced in source files:"));
    console.log(chalk.dim("  ─────────────────────────────────"));
    const preview = Object.entries(results.string_map).slice(0, 8);
    for (const [text, key] of preview) {
      console.log(`  ${chalk.dim(text.slice(0, 40).padEnd(42))} → ${chalk.cyan(`t('${key}')`)}`);
    }
    if (stringCount > 8) {
      console.log(chalk.dim(`  … and ${stringCount - 8} more`));
    }
    logger.blank();
    console.log(chalk.dim(`  ${fileSet.size} file(s) will be modified`));
    logger.blank();

    const { confirmReplace } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmReplace",
        message: `Replace ${chalk.white(stringCount)} hardcoded strings with t() calls?`,
        default: true,
      },
    ]);
    proceedWithReplace = confirmReplace;
    logger.blank();
  }

  // ── Step 6: Write files ───────────────────────────────────────────────────
  logger.step(6, 8, "Writing translation files…");
  const writeSpinner = ora({ text: "Writing files…", indent: 2 }).start();

  const outputDir = path.join(cwd, config.outputDir);
  let writtenFiles = [];

  try {
    writtenFiles = await writeTranslations(outputDir, results.translations);
    await updateScanStatus(config.apiKey, scanId, "files_written");
    writeSpinner.succeed(
      chalk.dim(`Wrote ${chalk.white(writtenFiles.length)} files`),
    );
  } catch (err) {
    writeSpinner.fail(`Failed to write files: ${err.message}`);
    process.exit(1);
  }

  logger.blank();

  // ── Step 7: Replace hardcoded strings in source files ────────────────────
  logger.step(7, 8, "Replacing hardcoded strings in source…");
  const replaceSpinner = ora({
    text: "Applying t() replacements…",
    indent: 2,
  }).start();

  let replacedFiles = [];
  try {
    if (proceedWithReplace && results.string_map && typeof results.string_map === "object" && Object.keys(results.string_map).length > 0) {
      replacedFiles = await replaceStringsInFiles(
        allStrings,
        results.string_map,
        cwd,
        framework,
      );
      replaceSpinner.succeed(
        chalk.dim(
          `Replaced strings in ${chalk.white(replacedFiles.length)} files`,
        ),
      );
    } else if (!proceedWithReplace) {
      replaceSpinner.succeed(chalk.dim("String replacement skipped"));
    } else {
      replaceSpinner.succeed(chalk.dim("No replacements needed"));
    }
  } catch (err) {
    replaceSpinner.warn(chalk.dim(`Replacement skipped: ${err.message}`));
  }

  // ── Step 8: i18n setup ───────────────────────────────────────────────────
  logger.step(8, 8, "Setting up i18n…");

  let setupFiles = [];
  if (wantsI18n) {
    // Install framework-specific i18n package
    const pkgToInstall =
      framework === "nextjs" ? "next-intl" : "i18next react-i18next";
    const installSpinner = ora({
      text: `Installing ${pkgToInstall}…`,
      indent: 2,
    }).start();
    try {
      execSync(`npm install ${pkgToInstall}`, { cwd, stdio: "pipe" });
      installSpinner.succeed(
        chalk.dim(`Installed ${chalk.white(pkgToInstall)}`),
      );
    } catch (err) {
      installSpinner.warn(chalk.dim(`Package install failed: ${err.message}`));
    }

    // ── Ask: language selector component? ────────────────────────────────────
    const { selectorChoice } = await inquirer.prompt([
      {
        type: "list",
        name: "selectorChoice",
        message: "Do you have a language selector component in your project?",
        choices: [
          { name: "Yes, I already have one", value: "existing" },
          { name: "No, please create it for me", value: "create" },
          { name: "No, but I'll create it myself later", value: "later" },
        ],
      },
    ]);
    logger.blank();

    const setupSpinner = ora({
      text: "Checking i18n setup…",
      indent: 2,
    }).start();
    try {
      setupFiles = await setupI18n(cwd, config.languages, selectorChoice === "create", framework, config.outputDir);
      if (setupFiles.length > 0) {
        setupSpinner.succeed(
          chalk.dim(`Created ${chalk.white(setupFiles.length)} i18n files`),
        );
      } else {
        setupSpinner.succeed(chalk.dim("i18n already set up"));
      }
    } catch (err) {
      setupSpinner.warn(chalk.dim(`Setup skipped: ${err.message}`));
    }
  } else {
    logger.info("i18n setup skipped.");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.blank();

  const table = new Table({
    chars: {
      top: "─",
      "top-mid": "─",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "─",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "│",
      mid: "─",
      "mid-mid": "─",
      right: "│",
      "right-mid": "│",
      middle: " ",
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

  if (replacedFiles.length) {
    table.push([
      chalk.dim(" ✏️  Code updated"),
      chalk.white(`${replacedFiles.length} source files`),
    ]);
  }

  if (setupFiles.length) {
    table.push([
      chalk.dim(" ⚙️  i18n setup"),
      chalk.white(setupFiles.join("\n")),
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
