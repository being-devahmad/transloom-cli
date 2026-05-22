import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { configExists, saveConfig, DEFAULT_CONFIG } from "../utils/config.js";
import { validateKey } from "../api/client.js";
import { logger } from "../utils/logger.js";

const ALL_LANGUAGES = [
  { name: "German      (de)", value: "de" },
  { name: "French      (fr)", value: "fr" },
  { name: "Spanish     (es)", value: "es" },
  { name: "Urdu        (ur)", value: "ur" },
  { name: "Chinese     (zh)", value: "zh" },
  { name: "Japanese    (ja)", value: "ja" },
  { name: "Arabic      (ar)", value: "ar" },
  { name: "Portuguese  (pt)", value: "pt" },
  { name: "Hindi       (hi)", value: "hi" },
  { name: "Russian     (ru)", value: "ru" },
];

export async function initCommand() {
  logger.blank();
  console.log(chalk.bold.white("  Transloom Init"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  if (await configExists()) {
    logger.warn(".transloom.json already exists!");
    logger.info("Run " + chalk.cyan("transloom scan") + " to start scanning.");
    logger.blank();
    return;
  }

  // 1. API Key
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Enter your API key:",
      mask: "*",
      validate: (v) => (v.startsWith("tl_") ? true : "Key must start with tl_"),
    },
  ]);

  // 2. Validate key
  const spinner = ora("Validating API key…").start();
  try {
    const result = await validateKey(apiKey);
    spinner.succeed(
      chalk.green(`Authenticated as `) + chalk.bold(result.user.username)
    );
    if (result.usage) {
      logger.dim(
        `Usage: ${result.usage.scans_used}/${result.usage.scans_limit === -1 ? "∞" : result.usage.scans_limit} scans`
      );
    }
  } catch {
    spinner.fail("Invalid API key. Check your dashboard.");
    logger.blank();
    process.exit(1);
  }

  logger.blank();

  // 3. Target languages
  const { languages } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "languages",
      message: "Select target languages:",
      choices: ALL_LANGUAGES,
      validate: (v) => (v.length > 0 ? true : "Pick at least one language."),
    },
  ]);

  // 4. Output directory
  const { outputDir } = await inquirer.prompt([
    {
      type: "input",
      name: "outputDir",
      message: "Output directory:",
      default: DEFAULT_CONFIG.outputDir,
    },
  ]);

  // 5. Namespace support
  const { namespace } = await inquirer.prompt([
    {
      type: "confirm",
      name: "namespace",
      message: "Enable namespace support? (groups keys by feature: auth.login, dashboard.title)",
      default: false,
    },
  ]);

  // 6. Save config
  const config = {
    ...DEFAULT_CONFIG,
    apiKey,
    languages: ["en", ...languages.filter((l) => l !== "en")],
    outputDir,
    namespace,
  };

  const configPath = await saveConfig(config);

  logger.blank();
  console.log(chalk.green("  ✅ Transloom initialized!"));
  logger.blank();
  logger.dim(`Config saved to ${configPath}`);
  logger.info(
    "Run " + chalk.cyan("transloom scan") + " to start!"
  );
  logger.blank();
}
