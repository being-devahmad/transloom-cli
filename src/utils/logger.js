import chalk from "chalk";

export const logger = {
  info: (msg) => console.log(chalk.cyan("  ℹ"), chalk.white(msg)),
  success: (msg) => console.log(chalk.green("  ✔"), chalk.white(msg)),
  warn: (msg) => console.log(chalk.yellow("  ⚠"), chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red("  ✖"), chalk.red(msg)),
  dim: (msg) => console.log(chalk.dim(`  ${msg}`)),
  blank: () => console.log(),
  step: (n, total, msg) =>
    console.log(chalk.dim(`  [${n}/${total}]`), chalk.white(msg)),
};
