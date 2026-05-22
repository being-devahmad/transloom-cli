import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export async function uninstallCommand() {
  logger.blank();
  console.log(chalk.bold.white("  Transloom Uninstall"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  const cwd = process.cwd();
  const config = await loadConfig();

  if (!config) {
    logger.error("No .transloom.json found. Nothing to uninstall.");
    logger.blank();
    process.exit(1);
  }

  // Confirm
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: chalk.yellow("This will remove installed i18n packages, generated files, and config. Continue?"),
      default: false,
    },
  ]);

  if (!confirmed) {
    logger.info("Uninstall cancelled.");
    logger.blank();
    return;
  }

  logger.blank();

  // ── Step 1: Uninstall packages ────────────────────────────────────────────
  const framework = config.framework || "nextjs";
  const pkgToRemove = framework === "nextjs" ? "next-intl" : "i18next react-i18next";

  const pkgSpinner = ora({ text: `Removing ${pkgToRemove}…`, indent: 2 }).start();
  try {
    execSync(`npm uninstall ${pkgToRemove}`, { cwd, stdio: "pipe" });
    pkgSpinner.succeed(chalk.dim(`Removed ${chalk.white(pkgToRemove)}`));
  } catch {
    pkgSpinner.warn(chalk.dim(`Could not remove packages (may not have been installed)`));
  }

  // ── Step 2: Delete generated files ───────────────────────────────────────
  const isAppRouter = await fs.pathExists(path.join(cwd, "app"));
  const hasSrc = await fs.pathExists(path.join(cwd, "src"));
  const componentsDir = isAppRouter
    ? path.join(cwd, "app", "components")
    : path.join(cwd, "src", "components");

  let filesToDelete = [];

  if (framework === "nextjs") {
    filesToDelete = [
      path.join(cwd, "i18n", "request.ts"),
      path.join(cwd, "middleware.ts"),
      path.join(componentsDir, "LanguageSelector.tsx"),
    ];
  } else {
    const baseDir = hasSrc ? path.join(cwd, "src") : cwd;
    filesToDelete = [
      path.join(baseDir, "i18n.ts"),
      path.join(baseDir, "I18nProvider.tsx"),
      path.join(baseDir, "components", "LanguageSelector.tsx"),
    ];
  }

  const filesSpinner = ora({ text: "Removing generated files…", indent: 2 }).start();
  const deleted = [];
  const skipped = [];

  for (const file of filesToDelete) {
    if (await fs.pathExists(file)) {
      await fs.remove(file);
      deleted.push(path.relative(cwd, file));
    } else {
      skipped.push(path.relative(cwd, file));
    }
  }

  // Remove i18n/ folder if empty (next-intl only)
  if (framework === "nextjs") {
    const i18nDir = path.join(cwd, "i18n");
    try {
      if (await fs.pathExists(i18nDir)) {
        const remaining = await fs.readdir(i18nDir);
        if (remaining.length === 0) await fs.remove(i18nDir);
      }
    } catch { /* ignore */ }
  }

  if (deleted.length > 0) {
    filesSpinner.succeed(chalk.dim(`Deleted ${chalk.white(deleted.length)} files`));
  } else {
    filesSpinner.succeed(chalk.dim("No generated files found"));
  }

  // ── Step 3: Delete translation files ─────────────────────────────────────
  const localesDir = path.join(cwd, config.outputDir || "public/locales");
  const localesSpinner = ora({ text: "Removing translation files…", indent: 2 }).start();
  try {
    if (await fs.pathExists(localesDir)) {
      await fs.remove(localesDir);
      localesSpinner.succeed(chalk.dim(`Removed ${chalk.white(config.outputDir || "public/locales")}`));
    } else {
      localesSpinner.succeed(chalk.dim("No translation files found"));
    }
  } catch (err) {
    localesSpinner.warn(chalk.dim(`Could not remove locales: ${err.message}`));
  }

  // ── Step 4: Delete config ─────────────────────────────────────────────────
  const configSpinner = ora({ text: "Removing .transloom.json…", indent: 2 }).start();
  try {
    await fs.remove(path.join(cwd, ".transloom.json"));
    configSpinner.succeed(chalk.dim("Removed .transloom.json"));
  } catch (err) {
    configSpinner.warn(chalk.dim(`Could not remove config: ${err.message}`));
  }

  logger.blank();
  console.log(chalk.green("  ✅ Transloom successfully uninstalled!"));
  logger.blank();
}
