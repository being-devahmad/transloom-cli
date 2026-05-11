import chalk from "chalk";
import ora from "ora";
import path from "path";
import { loadConfig } from "../utils/config.js";
import { validateKey } from "../api/client.js";
import { logger } from "../utils/logger.js";

export async function statusCommand() {
  logger.blank();
  console.log(chalk.bold.white("  Transloom Status"));
  console.log(chalk.dim("  ─────────────────────────────────"));
  logger.blank();

  // ── Config ────────────────────────────────────────────────────────────────
  const config = await loadConfig();

  if (!config) {
    logger.warn("No .transloom.json found in this directory.");
    logger.info("Run " + chalk.cyan("transloom init") + " to set up Transloom.");
    logger.blank();
    return;
  }

  const configPath = path.join(process.cwd(), ".transloom.json");
  logger.dim(`Config: ${configPath}`);
  logger.blank();

  // ── Account ───────────────────────────────────────────────────────────────
  const spinner = ora({ text: "Fetching account info…", indent: 2 }).start();

  let userData;
  try {
    userData = await validateKey(config.apiKey);
    spinner.stop();
  } catch {
    spinner.fail("Could not reach Transloom server. Check your internet connection.");
    logger.blank();
    process.exit(1);
  }

  const { user, usage } = userData;
  const scansUsed = usage?.scans_used ?? 0;
  const scansLimit = usage?.scans_limit === -1 ? null : (usage?.scans_limit ?? 3);
  const plan = user?.plan ?? "free";

  // ── Account block ─────────────────────────────────────────────────────────
  console.log(chalk.dim("  Account"));
  console.log(chalk.dim("  ────────────────────────────────────────────"));
  printRow("User", chalk.white(user?.username ?? "—"));
  printRow("Plan", planBadge(plan));
  logger.blank();

  // ── Usage block ───────────────────────────────────────────────────────────
  console.log(chalk.dim("  Usage (this month)"));
  console.log(chalk.dim("  ────────────────────────────────────────────"));

  const limitStr = scansLimit === null ? "∞" : String(scansLimit);
  const usageBar = scansLimit !== null ? " " + buildBar(scansUsed, scansLimit) : "";
  const usageColor =
    scansLimit === null || scansUsed < scansLimit
      ? chalk.white
      : chalk.red;

  printRow("Scans", usageColor(`${scansUsed} / ${limitStr}`) + usageBar);

  if (scansLimit !== null && scansUsed >= scansLimit) {
    logger.blank();
    logger.warn("Scan limit reached. Upgrade your plan to continue scanning.");
    logger.dim("  → https://localeflow.vercel.app/dashboard/billing");
  }

  logger.blank();

  // ── Config block ──────────────────────────────────────────────────────────
  console.log(chalk.dim("  Project Config"));
  console.log(chalk.dim("  ────────────────────────────────────────────"));
  printRow("Framework", chalk.white(config.framework ?? "nextjs"));
  printRow("Languages", chalk.white(config.languages?.join(", ") ?? "—"));
  printRow("Output Dir", chalk.white(config.outputDir ?? "—"));
  printRow(
    "Ignore",
    chalk.dim((config.ignore ?? []).join(", "))
  );
  logger.blank();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function printRow(label, value) {
  const pad = 14;
  console.log(
    chalk.dim("  " + label.padEnd(pad)),
    value
  );
}

function planBadge(plan) {
  if (plan === "pro") return chalk.magenta("Pro");
  if (plan === "team") return chalk.cyan("Team");
  return chalk.dim("Free");
}

function buildBar(used, limit) {
  const total = 12;
  const filled = Math.min(Math.round((used / limit) * total), total);
  const empty = total - filled;
  const color = filled >= total ? chalk.red : filled >= total * 0.66 ? chalk.yellow : chalk.violet ?? chalk.magenta;
  return chalk.dim("[") + color("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + chalk.dim("]");
}
