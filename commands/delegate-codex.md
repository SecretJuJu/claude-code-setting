# Delegate to Codex

Delegate exploration/analysis task to OpenAI Codex CLI.

## Instructions
1. Analyze the user request: $ARGUMENTS
2. Formulate a clear, context-rich prompt for Codex
3. Execute: `codex exec --skip-git-repo-check 'Think deeply. [task details with full context]'`
4. Compress Codex response to ≤200 tokens
5. Present compressed result with key insights

## Output Format
```
CODEX DELEGATION RESULT
Task: [brief description]
Key Findings:
- [finding 1]
- [finding 2]
Files: [relevant paths]
Recommendation: [1-2 sentences]
```

## Rules
- Include all necessary context in the Codex prompt
- Set timeout to 1800000 for complex analysis
- Never include raw Codex output; always compress
