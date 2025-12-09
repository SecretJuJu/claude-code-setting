#!/usr/bin/env bun
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const HOOK_NAME = "typescript-check-any-usage";
const RULES_DIR = join(dirname(dirname(__dirname)), "rules");

interface LanguageRules {
  extensions?: string[];
  excluded_extensions?: string[];
  messages?: Record<string, string | string[]>;
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

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const DEFAULT_EXCLUDED = [".d.ts"];

const ANY_KEYWORD = "any";
const ANY_PATTERNS = [
  { pattern: new RegExp(":\\s*" + ANY_KEYWORD + "\\b", "g"), desc: "Direct '" + ANY_KEYWORD + "' type annotation" },
  { pattern: new RegExp("<" + ANY_KEYWORD + ">", "g"), desc: "Generic '" + ANY_KEYWORD + "' type parameter" },
  { pattern: new RegExp("as\\s+" + ANY_KEYWORD + "\\b", "g"), desc: "Type assertion to '" + ANY_KEYWORD + "'" },
  { pattern: new RegExp("Array<" + ANY_KEYWORD + ">", "g"), desc: "Array of '" + ANY_KEYWORD + "'" },
  { pattern: new RegExp("Promise<" + ANY_KEYWORD + ">", "g"), desc: "Promise of '" + ANY_KEYWORD + "'" },
];

interface AnyUsage {
  line: number;
  column: number;
  text: string;
  description: string;
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
    console.log(`[${HOOK_NAME}] Skipping: No valid TypeScript file`);
    process.exit(0);
  }

  const content = readFileSync(filePath, "utf-8");
  const violations = detectAnyUsage(content);

  if (violations.length === 0) {
    console.log(`[${HOOK_NAME}] Success: No '${ANY_KEYWORD}' type usage found`);
    process.exit(0);
  }

  const message = buildErrorMessage(violations, filePath);
  console.error(message);
  process.exit(2);
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

function detectAnyUsage(content: string): AnyUsage[] {
  const violations: AnyUsage[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (line.includes("// @ts-ignore") || line.includes("// @ts-expect-error")) {
      continue;
    }

    for (const { pattern, desc } of ANY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(line)) !== null) {
        violations.push({
          line: i + 1,
          column: match.index + 1,
          text: line.trim().substring(0, 80),
          description: desc,
        });
      }
    }
  }

  return violations;
}

function buildErrorMessage(violations: AnyUsage[], filePath: string): string {
  const alternativesRaw = rules.messages?.any_alternatives;
  const alternatives = Array.isArray(alternativesRaw) ? alternativesRaw : [
    "Use 'unknown' if the type is truly unknown, then use type guards",
    "Use proper generic types (e.g., <T>, <T extends SomeType>)",
    "Use union types (e.g., string | number | null)",
    "Use specific interface or type definitions",
  ];

  let msg = `
<typescript-any-usage-error>
CRITICAL: '${ANY_KEYWORD}' TYPE USAGE DETECTED

File: ${filePath}
Found ${violations.length} violation(s)

`;

  for (const v of violations) {
    msg += `Line ${v.line}: ${v.description}\n  ${v.text}\n\n`;
  }

  msg += `
You are STRICTLY PROHIBITED from using the '${ANY_KEYWORD}' type.

ALTERNATIVES:
`;

  for (const alt of alternatives) {
    msg += `- ${alt}\n`;
  }

  msg += `
FIX IMMEDIATELY: Replace all '${ANY_KEYWORD}' types with proper type annotations.
</typescript-any-usage-error>
`;

  return msg;
}

main().catch((err) => {
  console.error(`[${HOOK_NAME}] Error:`, err);
  process.exit(0);
});
