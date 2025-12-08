# Claude Code Settings

My personal Claude Code configuration, forked from [code-yeongyu/my-claude-code-harness](https://github.com/code-yeongyu/my-claude-code-harness).

## Overview

This repository contains my customized Claude Code setup for daily development workflow. The original harness provides a sophisticated system for delegating work to AI agents with proper planning, execution, and verification loops.

## Prerequisites

### Required

| Tool | Description | Installation |
|------|-------------|--------------|
| [Claude Code](https://github.com/anthropics/claude-code) | Anthropic's CLI for Claude | `npm install -g @anthropic-ai/claude-code` |
| [uv](https://github.com/astral-sh/uv) | Python package manager (hooks 실행용) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [jq](https://jqlang.github.io/jq/) | JSON processor (hooks에서 사용) | `brew install jq` |
| [Bun](https://bun.sh/) | JS runtime (statusline용) | `curl -fsSL https://bun.sh/install \| bash` |

### Optional (Enhanced Features)

| Tool | Description | Installation |
|------|-------------|--------------|
| [OpenAI Codex CLI](https://github.com/openai/codex) | External LLM for complex tasks | `npm install -g @openai/codex` |
| [Perplexity MCP](https://github.com/ppl-ai/modelcontextprotocol) | Web search via MCP | MCP server 설정 필요 |
| [Context7 MCP](https://github.com/upstash/context7) | Library docs retrieval | MCP server 설정 필요 |
| [GitHub CLI](https://cli.github.com/) | PR/Issue 관리 | `brew install gh` |
| [ruff](https://github.com/astral-sh/ruff) | Python linter/formatter | `uv tool install ruff` |
| [ccusage](https://github.com/ryoppippi/ccusage) | Claude Code usage tracker | `bun add -g ccusage` |

### Python Hooks Dependencies

Hooks는 `uv run`으로 실행되며, 필요한 패키지는 자동으로 설치됩니다. 주요 의존성:

- Python 3.11+
- asyncio (built-in)

### MCP Server Configuration

`~/.claude/settings.local.json` 또는 프로젝트별 `.claude/settings.local.json`에 MCP 서버 설정:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-perplexity"],
      "env": { "PERPLEXITY_API_KEY": "your-api-key" }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

## Structure

```
.
├── CLAUDE.md              # Global instructions & prompt engineering
├── settings.json          # Claude Code settings (hooks only)
├── rules/                 # Language-specific rules (JSON)
│   ├── schema.json        # JSON schema for rules
│   ├── python.json        # Python linting, typing, comments rules
│   ├── typescript.json    # TypeScript type checking rules
│   └── load_rules.py      # Rules loader utility
├── commands/              # Custom slash commands
│   ├── execute.md         # /execute - Task orchestrator
│   └── planner.md         # /planner - Work plan generator
├── hooks/                 # Event-driven hooks
│   ├── post-tool-use/     # Triggers after tool usage
│   ├── user-prompt-submit/# Triggers on user input
│   └── post_tool_use.py   # Python hook handler
└── agents/                # Specialized agent definitions
    ├── executor.md        # Task executor agent
    └── plan-reviewer.md   # Plan review agent
```

## Language Rules

`rules/` 디렉토리에서 언어별 규칙을 JSON으로 관리합니다. 새 언어 추가 시 `{language}.json` 파일만 생성하면 됩니다.

**지원 언어:**
- **Python**: ruff 린팅, `Any` 타입 금지, 주석 정책, nested import 금지
- **TypeScript**: tsc 타입 체크, `any` 타입 금지

**규칙 커스터마이징 예시:**
```json
{
  "language": "python",
  "linting": {
    "always_enforce_rules": ["ANN001", "ANN201"],
    "line_length": 120
  },
  "type_checking": {
    "forbidden_types": ["Any"]
  }
}
```

## Workflow

```
User Request → /planner → ai-todolist.md → [plan-reviewer] → /execute → executor agents → Complete
```

1. **Planning**: `/planner` generates detailed work plans
2. **Review**: `plan-reviewer` agent validates plans from fresh context
3. **Execution**: `/execute` orchestrates task execution
4. **Verification**: Each task is verified before moving to next

## Key Concepts

- **One task at a time**: Executor agents handle exactly one atomic task per invocation
- **Knowledge accumulation**: Discoveries and patterns are recorded in notepad.md
- **Static analysis hooks**: Automated linting, formatting, and code quality checks
- **Dynamic context injection**: Relevant guidelines injected based on file types

## Credits

Based on the excellent work by [@code-yeongyu](https://github.com/code-yeongyu). See the [original repository](https://github.com/code-yeongyu/my-claude-code-harness) for comprehensive documentation and philosophy behind this setup.

## License

MIT
