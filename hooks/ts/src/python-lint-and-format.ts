#!/usr/bin/env bun
import { existsSync } from "fs";
import { getRules } from "./load-rules";
import type { PostToolUseInput, LanguageRules, LintingConfig } from "./types";

const HOOK_NAME = "python-lint-and-format";

const DEFAULT_ALWAYS_ENFORCE = ["ASYNC", "ANN001", "ANN201", "ANN202", "ANN204", "ANN205", "ANN206", "ANN401"];
const DEFAULT_FALLBACK_RULES = ["PLE", "PLW", "E", "W", "F", "I", "Q", "UP", "C4", "PT"];
const DEFAULT_LINE_LENGTH = 119;

const VENV_RUFF_PATHS = [".venv/bin/ruff", "venv/bin/ruff"];

interface RuffConfig {
  executablePath: string;
  lintArgs: string[];
  formatArgs: string[];
  useFallback: boolean;
}

interface RuffResults {
  lintOutput: string;
  lintExitCode: number;
  formatOutput: string;
  formatExitCode: number;
  hasUnusedImports: boolean;
  hasAutoFixes: boolean;
}

async function main(): Promise<void> {
  console.error(`\n[${HOOK_NAME}]`);

  const input = await Bun.stdin.text();
  const filePath = getTargetFilePath(input);

  if (!filePath) {
    console.log("[ruff-hook] Skipping: No valid Python file path provided or file is not .py");
    process.exit(0);
  }

  const config = await resolveRuffConfiguration();
  if (!config) {
    console.log("[ruff-hook] Skipping: ruff not found in .venv or system PATH");
    process.exit(0);
  }

  const results = await executeRuffOperations(config, filePath);
  handleResultsAndExit(results, filePath);
}

function getTargetFilePath(inputData: string): string | null {
  if (!inputData) return null;

  try {
    const data = JSON.parse(inputData) as PostToolUseInput;
    const toolInput = data.tool_input;

    let filePath = "";
    if (toolInput.file_path) {
      filePath = toolInput.file_path;
    } else if (toolInput.notebook_path) {
      filePath = toolInput.notebook_path;
    }

    return isValidPythonFile(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

function isValidPythonFile(filePath: string): boolean {
  if (!filePath || !filePath.endsWith(".py")) return false;
  return existsSync(filePath);
}

async function resolveRuffConfiguration(): Promise<RuffConfig | null> {
  const rules = getRules("python");
  const lintingConfig = rules?.linting;

  let ruffPath = findRuffExecutable(lintingConfig);
  let needsFallback = !ruffPath;

  if (!ruffPath) {
    const which = Bun.spawnSync(["which", "ruff"]);
    if (which.exitCode === 0) {
      ruffPath = which.stdout.toString().trim();
    }
  }

  if (!ruffPath) return null;

  const alwaysEnforce = lintingConfig?.always_enforce_rules || DEFAULT_ALWAYS_ENFORCE;
  const fallbackRules = lintingConfig?.fallback_rules || DEFAULT_FALLBACK_RULES;
  const lineLength = lintingConfig?.line_length || DEFAULT_LINE_LENGTH;

  if (needsFallback || shouldUseFallbackConfig()) {
    const allRules = [...fallbackRules, ...alwaysEnforce];
    return {
      executablePath: ruffPath,
      lintArgs: ["--select", allRules.join(","), "--line-length", String(lineLength)],
      formatArgs: ["--line-length", String(lineLength)],
      useFallback: true,
    };
  }

  return {
    executablePath: ruffPath,
    lintArgs: ["--extend-select", alwaysEnforce.join(",")],
    formatArgs: [],
    useFallback: false,
  };
}

function findRuffExecutable(config?: LintingConfig): string | null {
  const paths = config?.executable_paths || VENV_RUFF_PATHS;

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

function shouldUseFallbackConfig(): boolean {
  if (!existsSync("pyproject.toml")) return true;

  try {
    const content = Bun.file("pyproject.toml").text();
    return !content.then((c) => c.includes("[tool.ruff]"));
  } catch {
    return true;
  }
}

async function executeRuffOperations(config: RuffConfig, filePath: string): Promise<RuffResults> {
  const checkResult = Bun.spawnSync([config.executablePath, "check", "--unsafe-fixes", ...config.lintArgs, filePath]);
  const lintCheckOutput = checkResult.stdout.toString() + checkResult.stderr.toString();
  const hasUnusedImports = checkResult.exitCode !== 0 && lintCheckOutput.includes("F401");

  const fixResult = Bun.spawnSync([
    config.executablePath,
    "check",
    "--fix",
    "--exit-non-zero-on-fix",
    "--unsafe-fixes",
    "--extend-ignore",
    "F401",
    ...config.lintArgs,
    filePath,
  ]);

  let fixOutput = fixResult.stdout.toString() + fixResult.stderr.toString();
  let fixExitCode = fixResult.exitCode;
  const hasAutoFixes = fixExitCode !== 0;

  if (hasAutoFixes && fixOutput) {
    const recheck = Bun.spawnSync([config.executablePath, "check", "--unsafe-fixes", ...config.lintArgs, filePath]);
    fixOutput = recheck.stdout.toString() + recheck.stderr.toString();
    fixExitCode = recheck.exitCode;
  }

  const formatCheck = Bun.spawnSync([config.executablePath, "format", "--check", ...config.formatArgs, filePath]);
  const hasFormatChanges = formatCheck.exitCode !== 0;

  let formatOutput = "";
  if (hasFormatChanges) {
    Bun.spawnSync([config.executablePath, "format", ...config.formatArgs, filePath]);
    formatOutput = `1 file reformatted: ${filePath}`;
  }

  return {
    lintOutput: fixOutput.trim(),
    lintExitCode: fixExitCode,
    formatOutput,
    formatExitCode: hasFormatChanges ? 1 : 0,
    hasUnusedImports,
    hasAutoFixes,
  };
}

function handleResultsAndExit(results: RuffResults, filePath: string): void {
  const hasOnlyFormatting = results.formatExitCode !== 0 && results.lintExitCode === 0 && !results.hasUnusedImports;

  if (hasOnlyFormatting) {
    if (results.formatOutput) {
      const msg = `<ruff-format>\n${results.formatOutput}\n\nFILE REFORMATTED\nThe file has been reformatted by ruff.\nNEXT STEP: Use Read() to view the reformatted content before making further edits.\n</ruff-format>`;
      console.error(`\n${msg}\n`);
    }
    process.exit(2);
  }

  const message = buildErrorMessage(results);

  if (!message) {
    console.log("[ruff-hook] Success: No lint or format issues found");
    process.exit(0);
  }

  if (results.hasAutoFixes && results.lintExitCode === 0 && results.formatExitCode === 0) {
    console.error(message);
    process.exit(2);
  }

  if (results.lintExitCode !== 0 || results.formatExitCode !== 0 || results.hasUnusedImports) {
    console.error(message);
    process.exit(2);
  }

  process.exit(0);
}

function buildErrorMessage(results: RuffResults): string {
  const parts: string[] = [];

  if (results.hasAutoFixes && results.lintExitCode === 0) {
    if (results.lintOutput) {
      parts.push(`\n<ruff-auto-fixed>\n${results.lintOutput}\n\nFILE AUTOMATICALLY MODIFIED\nThe file has been changed by ruff auto-fix.\nREQUIRED ACTION: Use Read() to get the latest file content before any Edit() operations.\n</ruff-auto-fixed>\n`);
    }
  } else if (results.lintExitCode !== 0 && results.lintOutput) {
    parts.push(`\n<ruff-lint>\n${results.lintOutput}\n</ruff-lint>\n`);
  }

  if (results.formatExitCode !== 0 && results.formatOutput) {
    parts.push(`\n<ruff-format>\n${results.formatOutput}\n</ruff-format>\n`);
  }

  if (results.hasUnusedImports) {
    parts.push(getUnusedImportsWarning());
  }

  const message = parts.join("");

  if (message && (results.lintExitCode !== 0 || results.hasUnusedImports)) {
    return message + "\n\n" + getErrorFixReminder();
  }

  return message;
}

function getUnusedImportsWarning(): string {
  return `
CRITICAL ERROR: UNUSED IMPORTS DETECTED - IMMEDIATE ACTION REQUIRED

You have added import statements that are NOT being used anywhere in the code.

**WHAT YOU MUST DO RIGHT NOW:**
Option 1: DELETE the unused import immediately
Option 2: ADD code that actually USES the import

**WARNING**: FILE HAS BEEN MODIFIED - Use Read() before attempting Edit again.
`;
}

function getErrorFixReminder(): string {
  return `**CRITICAL: DO NOT IGNORE THESE ERRORS!**
You MUST fix ALL lint errors and formatting issues shown above.
These are not warnings - they are REQUIRED fixes.
The code WILL NOT pass CI/CD until these are resolved.

IMPORTANT: If the file was auto-fixed, use Read() before Edit to avoid conflicts.`;
}

main().catch((err) => {
  console.error(`[${HOOK_NAME}] Error:`, err);
  process.exit(0);
});
