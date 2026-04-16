#!/bin/bash
# Auto-start oh-my-claude proxy

# Source NVM
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

if ! command -v omc &>/dev/null; then
    echo "[oh-my-claude] omc not found in PATH, skipping auto-start"
    exit 0
fi

# Check if already running
if omc proxy status &>/dev/null; then
    echo "[oh-my-claude] Proxy already running"
    exit 0
fi

# Check for config
OMC_CONFIG="${HOME}/.oh-my-claude/config.json"
if [ ! -f "$OMC_CONFIG" ]; then
    echo "[oh-my-claude] No config at ${OMC_CONFIG} — skipping auto-start"
    echo "[oh-my-claude] Run 'codeforge config apply' to deploy config, then 'omc proxy start'"
    exit 0
fi

# Check for at least one Chinese provider API key
_HAS_KEY=false
for _VAR in KIMI_API_KEY ZHIPU_API_KEY ALIYUN_API_KEY MINIMAX_API_KEY DEEPSEEK_API_KEY; do
    if [ -n "${!_VAR:-}" ]; then
        _HAS_KEY=true
        break
    fi
done

if [ "$_HAS_KEY" = "false" ]; then
    echo "[oh-my-claude] No provider API keys configured — skipping auto-start"
    exit 0
fi

# Start with supervisor
(
    while true; do
        omc proxy start 2>&1 | tee -a /tmp/oh-my-claude.log
        echo "[oh-my-claude] Proxy exited, restarting in 2s..."
        sleep 2
    done
) &
SUPERVISOR_PID=$!
echo $SUPERVISOR_PID > /tmp/oh-my-claude-supervisor.pid
echo "[oh-my-claude] Proxy started with supervisor (PID: $SUPERVISOR_PID)"
