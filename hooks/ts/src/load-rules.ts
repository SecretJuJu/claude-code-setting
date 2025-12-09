import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { LanguageRules } from "./types";

const RULES_DIR = join(dirname(dirname(dirname(__dirname))), "rules");

const rulesCache = new Map<string, LanguageRules>();
const extensionMap = new Map<string, string>();

function buildExtensionMap(): void {
  if (extensionMap.size > 0) return;

  const fs = require("fs");
  const files = fs.readdirSync(RULES_DIR) as string[];

  for (const file of files) {
    if (!file.endsWith(".json") || file === "schema.json") continue;

    try {
      const content = readFileSync(join(RULES_DIR, file), "utf-8");
      const rules = JSON.parse(content) as LanguageRules;
      const language = rules.language || file.replace(".json", "");

      for (const ext of rules.extensions || []) {
        extensionMap.set(ext, language);
      }
    } catch {
      continue;
    }
  }
}

export function getRules(language: string): LanguageRules | null {
  if (rulesCache.has(language)) {
    return rulesCache.get(language)!;
  }

  const rulesFile = join(RULES_DIR, `${language}.json`);

  if (!existsSync(rulesFile)) {
    return null;
  }

  try {
    const content = readFileSync(rulesFile, "utf-8");
    const rules = JSON.parse(content) as LanguageRules;
    rulesCache.set(language, rules);
    return rules;
  } catch {
    return null;
  }
}

export function getRulesForFile(filePath: string): LanguageRules | null {
  buildExtensionMap();

  const ext = filePath.substring(filePath.lastIndexOf("."));

  const language = extensionMap.get(ext);
  if (!language) return null;

  return getRules(language);
}

export function isExcludedPath(filePath: string, rules: LanguageRules): boolean {
  const excludedPaths = rules.excluded_paths || [];

  for (const pattern of excludedPaths) {
    if (filePath.includes(pattern)) {
      return true;
    }
  }

  return false;
}

export function isExcludedExtension(filePath: string, rules: LanguageRules): boolean {
  const excludedExtensions = rules.excluded_extensions || [];

  for (const ext of excludedExtensions) {
    if (filePath.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

export function getMessage(rules: LanguageRules, key: string, defaultMsg = ""): string {
  return rules.messages?.[key] || defaultMsg;
}
