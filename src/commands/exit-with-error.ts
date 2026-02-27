import chalk from "chalk";

/**
 * Log message in red and exit with code. Use for command-line error handling.
 */
export function exitWithError(message: string, code: number = 1): never {
    console.error(chalk.red(message));
    process.exit(code);
}
