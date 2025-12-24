#!/usr/bin/env bun
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

const HOOK_NAME = "typescript-typecheck";
const RULES_DIR = join(dirname(dirname(__dirname)), "rules");

interface TypeCheckingConfig {
  executable_paths?: string[];
  fallback_options?: string[];
}

interface LanguageRules {
  extensions?: string[];
  excluded_extensions?: string[];
  type_checking?: TypeCheckingConfig;
}

function loadTypeScriptRules(): LanguageRules {
  const rulesFile = join(RULES_DIR, "typescript.json");
  if (existsSync(rulesFile)) {
    try {
      return JSON.parse(readFileSync(rulesFile, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

const rules = loadTypeScriptRules();

const DEFAULT_TSC_PATHS = ["node_modules/.bin/tsc", "node_modules/typescript/bin/tsc"];
const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const DEFAULT_EXCLUDED = [".d.ts"];

interface PostToolUseInput {
  tool_input: {
    file_path?: string;
    notebook_path?: string;
  };
}

interface TscResult {
  output: string;
  exitCode: number;
  errorCount: number;
}

async function main(): Promise<void> {
  console.error(`\n[${HOOK_NAME}]`);

  const input = await Bun.stdin.text();
  const filePath = getTargetFilePath(input);

  if (!filePath) {
    console.log(`[${HOOK_NAME}] Skipping: No valid TypeScript file`);
    process.exit(0);
  }

  const tscPath = findTscExecutable();
  if (!tscPath) {
    console.log(`[${HOOK_NAME}] Skipping: tsc not found`);
    process.exit(0);
  }

  const result = executeTsc(tscPath, filePath);
  handleResults(result, filePath);
}

function getTargetFilePath(inputData: string): string | null {
  if (!inputData) return null;

  try {
    const data = JSON.parse(inputData) as PostToolUseInput;
    const toolInput = data.tool_input;

    const filePath = toolInput.file_path || toolInput.notebook_path || "";
    return isValidTypeScriptFile(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

function isValidTypeScriptFile(filePath: string): boolean {
  if (!filePath) return false;

  const validExtensions = rules.extensions || DEFAULT_EXTENSIONS;
  const excludedExtensions = rules.excluded_extensions || DEFAULT_EXCLUDED;

  const ext = filePath.substring(filePath.lastIndexOf("."));

  if (!validExtensions.includes(ext)) return false;

  for (const excluded of excludedExtensions) {
    if (filePath.endsWith(excluded)) return false;
  }

  return existsSync(filePath);
}

function findTscExecutable(): string | null {
  const paths = rules.type_checking?.executable_paths || DEFAULT_TSC_PATHS;

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  const which = Bun.spawnSync(["which", "tsc"]);
  if (which.exitCode === 0) {
    return which.stdout.toString().trim();
  }

  return null;
}

function executeTsc(tscPath: string, filePath: string): TscResult {
  const hasTsConfig = existsSync("tsconfig.json");

  const args = hasTsConfig
    ? ["--noEmit", filePath]
    : ["--noEmit", "--strict", "--esModuleInterop", "--skipLibCheck", "--target", "ES2020", "--module", "commonjs", filePath];

  const result = Bun.spawnSync([tscPath, ...args]);
  const output = result.stdout.toString() + result.stderr.toString();

  const errorMatches = output.match(/error TS\d+/g);
  const errorCount = errorMatches?.length || 0;

  return {
    output: output.trim(),
    exitCode: result.exitCode,
    errorCount,
  };
}

function handleResults(result: TscResult, filePath: string): void {
  if (result.exitCode === 0) {
    console.log(`[${HOOK_NAME}] Success: No type errors found`);
    process.exit(0);
  }

  const message = buildErrorMessage(result, filePath);
  console.error(message);
  process.exit(2);
}

function buildErrorMessage(result: TscResult, filePath: string): string {
  return `
<typescript-errors>
TypeScript type checking failed for: ${filePath}
Found ${result.errorCount} error(s)

${result.output}

REQUIRED ACTIONS:
- Fix all type errors shown above
- Ensure proper type annotations
- Use specific types instead of 'any'
- Ensure proper generic type parameters
</typescript-errors>
`;
}

main().catch((err) => {
  console.error(`[${HOOK_NAME}] Error:`, err);
  process.exit(0);
});
