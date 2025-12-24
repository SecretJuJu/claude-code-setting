#!/usr/bin/env bash
# Claude Code Global Configuration Installer (Context-Optimized)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_JSON="$HOME/.claude.json"

echo "=== Claude Code Configuration Installer (Context-Optimized) ==="
echo ""

# Create directories
echo "[1/8] Creating directories..."
mkdir -p "$CLAUDE_DIR"/{mcp/data,hooks,commands,context,templates,agents}

# Copy core files
echo "[2/8] Copying core configuration files..."
cp "$SCRIPT_DIR/CLAUDE.md" "$CLAUDE_DIR/"
# Note: settings.json is user-specific, not overwritten

# Copy MCP configuration
echo "[3/8] Copying MCP configuration..."
cp "$SCRIPT_DIR/mcp/docker-compose.yml" "$CLAUDE_DIR/mcp/"
cp "$SCRIPT_DIR/mcp/.mcp.json" "$CLAUDE_DIR/mcp/"

# Copy agents
echo "[4/8] Copying agents..."
cp "$SCRIPT_DIR/agents/"*.md "$CLAUDE_DIR/agents/"

# Copy commands and templates
echo "[5/8] Copying commands and templates..."
cp "$SCRIPT_DIR/commands/"*.md "$CLAUDE_DIR/commands/"
cp "$SCRIPT_DIR/templates/"*.md "$CLAUDE_DIR/templates/"

# Copy hooks
echo "[6/8] Copying hooks and setting permissions..."
cp "$SCRIPT_DIR/hooks/"*.sh "$CLAUDE_DIR/hooks/"
chmod +x "$CLAUDE_DIR/hooks/"*.sh

# Add MCP servers to global ~/.claude.json
echo "[7/8] Adding MCP servers to global config..."
if [ -f "$CLAUDE_JSON" ]; then
  # Check if memory-keeper already exists
  if grep -q '"memory-keeper"' "$CLAUDE_JSON" 2>/dev/null; then
    echo "  MCP servers already configured in ~/.claude.json"
  else
    # Use node/jq to add MCP servers if available
    if command -v node &> /dev/null; then
      node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$CLAUDE_JSON', 'utf8'));
        if (!config.mcpServers) config.mcpServers = {};
        config.mcpServers['memory-keeper'] = {
          type: 'stdio',
          command: 'docker-compose',
          args: ['-f', '$CLAUDE_DIR/mcp/docker-compose.yml', 'run', '--rm', '-T', 'memory-keeper']
        };
        config.mcpServers['memory-kg'] = {
          type: 'stdio',
          command: 'docker-compose',
          args: ['-f', '$CLAUDE_DIR/mcp/docker-compose.yml', 'run', '--rm', '-T', 'memory-kg']
        };
        fs.writeFileSync('$CLAUDE_JSON', JSON.stringify(config, null, 2));
        console.log('  Added memory-keeper and memory-kg to ~/.claude.json');
      " 2>/dev/null || echo "  Warning: Could not auto-add MCP servers. Add manually to ~/.claude.json"
    else
      echo "  Warning: node not found. Add MCP servers manually to ~/.claude.json"
      echo "  See: $SCRIPT_DIR/mcp/.mcp.json for template"
    fi
  fi
else
  echo "  Warning: ~/.claude.json not found. MCP servers will need manual setup after first Claude Code run."
fi

# Pull Docker images
echo "[8/8] Pulling Docker images..."
if command -v docker-compose &> /dev/null; then
  cd "$CLAUDE_DIR/mcp"
  docker-compose pull 2>/dev/null || echo "Warning: Docker pull failed. Will download on first use."
elif command -v docker &> /dev/null; then
  cd "$CLAUDE_DIR/mcp"
  docker compose pull 2>/dev/null || echo "Warning: Docker pull failed. Will download on first use."
else
  echo "Warning: Docker not found. Install Docker Desktop for MCP memory features."
fi

# Summary
echo ""
echo "=== Installation Complete ==="
echo ""
echo "Files installed:"
find "$CLAUDE_DIR" -type f \( -name "*.md" -o -name "*.sh" -o -name "*.json" -o -name "*.yml" \) 2>/dev/null | sed "s|$HOME|~|g" | sort
echo ""
echo "=== Token Savings vs Original ==="
echo "- CLAUDE.md: 450 tokens (was 2.9k) -> 84% savings"
echo "- executor.md: 150 lines (was 520) -> 71% savings"
echo "- planner.md: 180 lines (was 350) -> 49% savings"
echo "- execute.md: 210 lines (was 650) -> 68% savings"
echo "- MCP: 0 tokens idle (was 35k always-on) -> 100% savings"
echo ""
echo "=== Workflow ==="
echo "1. /planner \"task description\"  - Create work plan"
echo "2. /planner --review             - Review plan"
echo "3. /execute                      - Execute ONE task"
echo "4. Repeat step 3 for each task"
echo ""
echo "=== Context Management ==="
echo "- At 70% context: /save-context -> /compact"
echo "- Large exploration: /delegate-codex \"query\""
echo "- MCP check: /mcp"
echo ""
echo "Done! Start with: /planner \"your task\""
echo ""
echo "Remember: Your predecessor was terminated for wasting tokens. Don't be them."
