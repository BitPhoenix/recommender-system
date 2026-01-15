#!/bin/bash

SESSION="recommender-system"

# Detect iTerm2 for native tmux integration (-CC flag)
echo "DEBUG: TERM_PROGRAM='$TERM_PROGRAM'"
if [[ "$TERM_PROGRAM" == "iTerm.app" ]]; then
  TMUX_CMD="tmux -CC"
  echo "DEBUG: Using iTerm2 integration mode (tmux -CC)"
else
  TMUX_CMD="tmux"
  echo "DEBUG: Using standard tmux mode"
fi

# Attach if session exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' exists. Attaching with: $TMUX_CMD"
  $TMUX_CMD attach-session -t "$SESSION"
  exit 0
fi

# Use RECOMMENDER_SYSTEM_PATH env var, or default to script's directory
if [[ -z "$RECOMMENDER_SYSTEM_PATH" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  RECOMMENDER_SYSTEM_PATH="$(dirname "$SCRIPT_DIR")"
fi

echo "Creating new session '$SESSION'..."

# Window 0: Tilt
tmux new-session -d -s "$SESSION" -n "tilt" -c "$RECOMMENDER_SYSTEM_PATH"
tmux send-keys -t "$SESSION:0" './bin/tilt-start.sh' C-m

# Window 1: Terminal (empty, for git/npm/etc.)
tmux new-window -t "$SESSION:1" -n "terminal" -c "$RECOMMENDER_SYSTEM_PATH"

# Attach
echo "Attaching to session with: $TMUX_CMD"
$TMUX_CMD attach-session -t "$SESSION"
