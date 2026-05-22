#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { statusCommand } from "./commands/status.js";
import { uninstallCommand } from "./commands/uninstall.js";

const program = new Command();

program
  .name("transloom")
  .description("AI-powered i18n automation for React/Next.js")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Transloom in your project")
  .action(async () => {
    try {
      await initCommand();
    } catch (err) {
      console.error(chalk.red("\n  Unexpected error:"), err.message);
      process.exit(1);
    }
  });

program
  .command("scan")
  .description("Scan project for hardcoded strings and translate them")
  .action(async () => {
    try {
      await scanCommand();
    } catch (err) {
      console.error(chalk.red("\n  Unexpected error:"), err.message);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show account info, usage, and project config")
  .action(async () => {
    try {
      await statusCommand();
    } catch (err) {
      console.error(chalk.red("\n  Unexpected error:"), err.message);
      process.exit(1);
    }
  });

program
  .command("uninstall")
  .description("Remove Transloom packages, generated files, and config")
  .action(async () => {
    try {
      await uninstallCommand();
    } catch (err) {
      console.error(chalk.red("\n  Unexpected error:"), err.message);
      process.exit(1);
    }
  });

program.parse();
