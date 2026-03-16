#!/usr/bin/env bun
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

const HOOK_NAME = "python-lint-and-format";
const RULES_DIR = join(dirname(dirname(__dirname)), "rules");

interface LintingConfig {
  always_enforce_rules?: string[];
  fallback_rules?: string[];
  line_length?: number;
  executable_paths?: string[];
}

interface LanguageRules {
  linting?: LintingConfig;
  excluded_paths?: string[];
}

function loadPythonRules(): LanguageRules {
  const rulesFile = join(RULES_DIR, "python.json");
  if (existsSync(rulesFile)) {
    try {
      return JSON.parse(readFileSync(rulesFile, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

const rules = loadPythonRules();
const lintingConfig = rules.linting || {};

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

interface PostToolUseInput {
  tool_input: {
    file_path?: string;
    notebook_path?: string;
  };
}

async function main(): Promise<void> {
  console.error(`\n[${HOOK_NAME}]`);

  const input = await Bun.stdin.text();
  const filePath = getTargetFilePath(input);

  if (!filePath) {
    console.log("[ruff-hook] Skipping: No valid Python file path provided or file is not .py");
    process.exit(0);
  }

  const config = resolveRuffConfiguration();
  if (!config) {
    console.log("[ruff-hook] Skipping: ruff not found in .venv or system PATH");
    process.exit(0);
  }

  const results = executeRuffOperations(config, filePath);
  handleResultsAndExit(results);
}

function getTargetFilePath(inputData: string): string | null {
  if (!inputData) return null;

  try {
    const data = JSON.parse(inputData) as PostToolUseInput;
    const toolInput = data.tool_input;

    const filePath = toolInput.file_path || toolInput.notebook_path || "";
    return isValidPythonFile(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

function isValidPythonFile(filePath: string): boolean {
  if (!filePath || !filePath.endsWith(".py")) return false;
  return existsSync(filePath);
}

function resolveRuffConfiguration(): RuffConfig | null {
  let ruffPath = findRuffExecutable();
  let needsFallback = !ruffPath;

  if (!ruffPath) {
    const which = Bun.spawnSync(["which", "ruff"]);
    if (which.exitCode === 0) {
      ruffPath = which.stdout.toString().trim();
    }
  }

  if (!ruffPath) return null;

  const alwaysEnforce = lintingConfig.always_enforce_rules || DEFAULT_ALWAYS_ENFORCE;
  const fallbackRules = lintingConfig.fallback_rules || DEFAULT_FALLBACK_RULES;
  const lineLength = lintingConfig.line_length || DEFAULT_LINE_LENGTH;

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

function findRuffExecutable(): string | null {
  const paths = lintingConfig.executable_paths || VENV_RUFF_PATHS;

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  return null;
}

function shouldUseFallbackConfig(): boolean {
  return !existsSync("pyproject.toml");
}

function executeRuffOperations(config: RuffConfig, filePath: string): RuffResults {
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

function handleResultsAndExit(results: RuffResults): void {
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
    parts.push(`
CRITICAL ERROR: UNUSED IMPORTS DETECTED - IMMEDIATE ACTION REQUIRED

You have added import statements that are NOT being used anywhere in the code.

**WHAT YOU MUST DO RIGHT NOW:**
Option 1: DELETE the unused import immediately
Option 2: ADD code that actually USES the import

**WARNING**: FILE HAS BEEN MODIFIED - Use Read() before attempting Edit again.
`);
  }

  const message = parts.join("");

  if (message && (results.lintExitCode !== 0 || results.hasUnusedImports)) {
    return message + `\n\n**CRITICAL: DO NOT IGNORE THESE ERRORS!**
You MUST fix ALL lint errors and formatting issues shown above.
These are not warnings - they are REQUIRED fixes.
The code WILL NOT pass CI/CD until these are resolved.

IMPORTANT: If the file was auto-fixed, use Read() before Edit to avoid conflicts.`;
  }

  return message;
}

main().catch((err) => {
  console.error(`[${HOOK_NAME}] Error:`, err);
  process.exit(0);
});
