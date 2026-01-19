# Save Context Checkpoint

Save current session context to memory-keeper before compaction.

## Instructions
1. Summarize current session state
2. Identify key decisions made
3. List pending tasks
4. Save to memory-keeper MCP

## Execution
```javascript
mcp_context_save({
  key: 'checkpoint_$TIMESTAMP',
  value: '[session summary]',
  category: 'checkpoint',
  priority: 'high'
});

mcp_context_prepare_compaction();
```

## Output
```
CHECKPOINT SAVED
Key: checkpoint_[timestamp]
Decisions: [count]
Pending: [count]
Next: Run /compact then /restore-context
```
