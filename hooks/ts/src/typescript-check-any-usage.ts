#!/usr/bin/env bun
import { readFileSync, existsSync } from "fs";
import { getRules } from "./load-rules";
import type { PostToolUseInput } from "./types";

const HOOK_NAME = "typescript-check-any-usage";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const DEFAULT_EXCLUDED = [".d.ts"];

const ANY_PATTERNS = [
  { pattern: /:\s*any\b/g, desc: "Direct 'any' type annotation" },
  { pattern: new RegExp("<" + "any>", "g"), desc: "Generic 'any' type parameter" },
  { pattern: /as\s+any\b/g, desc: "Type assertion to 'any'" },
  { pattern: new RegExp("Array<" + "any>", "g"), desc: "Array of 'any'" },
  { pattern: new RegExp("Promise<" + "any>", "g"), desc: "Promise of 'any'" },
];

interface AnyUsage {
  line: number;
  column: number;
  text: string;
  description: string;
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
    console.log(`[${HOOK_NAME}] Success: No 'any' type usage found`);
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

  const rules = getRules("typescript");
  const validExtensions = rules?.extensions || DEFAULT_EXTENSIONS;
  const excludedExtensions = rules?.excluded_extensions || DEFAULT_EXCLUDED;

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
  const rules = getRules("typescript");
  const alternatives = rules?.messages?.any_alternatives || [
    "Use 'unknown' if the type is truly unknown, then use type guards",
    "Use proper generic types (e.g., <T>, <T extends SomeType>)",
    "Use union types (e.g., string | number | null)",
    "Use specific interface or type definitions",
  ];

  let msg = `
<typescript-any-usage-error>
CRITICAL: 'any' TYPE USAGE DETECTED

File: ${filePath}
Found ${violations.length} violation(s)

`;

  for (const v of violations) {
    msg += `Line ${v.line}: ${v.description}\n  ${v.text}\n\n`;
  }

  msg += `
You are STRICTLY PROHIBITED from using the 'any' type.

ALTERNATIVES:
`;

  for (const alt of alternatives) {
    msg += `- ${alt}\n`;
  }

  msg += `
FIX IMMEDIATELY: Replace all 'any' types with proper type annotations.
</typescript-any-usage-error>
`;

  return msg;
}

main().catch((err) => {
  console.error(`[${HOOK_NAME}] Error:`, err);
  process.exit(0);
});
