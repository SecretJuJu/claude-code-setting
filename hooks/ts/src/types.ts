export interface PostToolUseInput {
  session_id: string;
  tool_name: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  tool_input: ToolInput;
  tool_response: ToolResponse;
}

export interface ToolInput {
  file_path?: string;
  notebook_path?: string;
  content?: string;
  old_string?: string;
  new_string?: string;
}

export interface ToolResponse {
  success?: boolean;
  type?: string;
  filePath?: string;
  structuredPatch?: unknown;
}

export interface LanguageRules {
  language: string;
  extensions: string[];
  excluded_extensions?: string[];
  excluded_paths?: string[];
  linting?: LintingConfig;
  formatting?: FormattingConfig;
  type_checking?: TypeCheckingConfig;
  imports?: ImportsConfig;
  comments?: CommentsConfig;
  messages?: Record<string, string>;
}

export interface LintingConfig {
  tool: string;
  executable_paths?: string[];
  always_enforce_rules?: string[];
  fallback_rules?: string[];
  line_length?: number;
  auto_fix?: boolean;
  unsafe_fixes?: boolean;
  exclude_from_autofix?: string[];
}

export interface FormattingConfig {
  tool: string;
  line_length?: number;
  auto_format?: boolean;
}

export interface TypeCheckingConfig {
  tool: string;
  executable_paths?: string[];
  forbidden_types?: string[];
  forbidden_patterns?: ForbiddenPattern[];
  config_file?: string;
  strict_mode?: boolean;
  fallback_options?: string[];
}

export interface ForbiddenPattern {
  pattern: string;
  description: string;
  suggestion: string;
}

export interface ImportsConfig {
  allow_nested?: boolean;
  type_checking_exceptions?: boolean;
  warn_unused?: boolean;
}

export interface CommentsConfig {
  require_justification?: boolean;
  allowed_prefixes?: string[];
  bdd_keywords?: string[];
  skip_extensions?: string[];
}
