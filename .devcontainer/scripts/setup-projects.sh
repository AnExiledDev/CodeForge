#!/bin/bash
# Auto-detect projects under /workspaces/ and register them in Project Manager's projects.json.
# Runs an initial scan synchronously, then starts an inotifywait background watcher
# that updates the project list instantly when directories are created or removed.

set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
PROJECTS_DIR="${WORKSPACE_ROOT}/.config/project-manager"
PROJECTS_FILE="${PROJECTS_DIR}/projects.json"
PID_FILE="/tmp/project-watcher.pid"
LOG_PREFIX="[setup-projects]"

# Directories to exclude from project detection (hidden/config dirs)
EXCLUDED_DIRS=".claude .gh .tmp .devcontainer .config node_modules .git"

# --- Helpers ---

is_excluded() {
	local name="$1"
	# Skip hidden directories (start with .)
	[[ "$name" == .* ]] && return 0
	# Skip explicitly excluded names
	for excluded in $EXCLUDED_DIRS; do
		[[ "$name" == "$excluded" ]] && return 0
	done
	return 1
}

has_project_markers() {
	local dir="$1"
	[ -d "$dir/.git" ] || [ -f "$dir/package.json" ] || [ -f "$dir/pyproject.toml" ] ||
		[ -f "$dir/Cargo.toml" ] || [ -f "$dir/go.mod" ] || [ -f "$dir/deno.json" ] ||
		[ -f "$dir/Makefile" ] || [ -f "$dir/CLAUDE.md" ]
}

detect_tags() {
	local dir="$1"
	local tags=()

	[ -d "$dir/.git" ] && tags+=("git")
	[ -f "$dir/package.json" ] && tags+=("node")
	[ -f "$dir/pyproject.toml" ] && tags+=("python")
	[ -f "$dir/Cargo.toml" ] && tags+=("rust")
	[ -f "$dir/go.mod" ] && tags+=("go")
	[ -f "$dir/deno.json" ] && tags+=("deno")
	[ -f "$dir/Makefile" ] && tags+=("make")
	[ -f "$dir/CLAUDE.md" ] && tags+=("claude")

	# Always add "auto" tag to mark as script-managed
	tags+=("auto")

	# If no markers found (only "auto"), add "folder" tag
	if [ ${#tags[@]} -eq 1 ]; then
		tags=("folder" "${tags[@]}")
	fi

	# Output as JSON array
	printf '%s\n' "${tags[@]}" | jq -R . | jq -s .
}

register_project() {
	local projects_json="$1"
	local name="$2"
	local dir="$3"
	local tags
	tags=$(detect_tags "$dir")
	echo "$projects_json" | jq \
		--arg name "$name" \
		--arg path "$dir" \
		--argjson tags "$tags" \
		'. += [{"name": $name, "rootPath": ($path | rtrimstr("/")), "tags": $tags, "enabled": true}]'
}

scan_and_update() {
	# Build the new auto-detected projects array (two-pass: depth 1 + depth 2)
	local new_projects="[]"

	for dir in "$WORKSPACE_ROOT"/*/; do
		[ -d "$dir" ] || continue
		local name
		name=$(basename "$dir")

		is_excluded "$name" && continue

		if has_project_markers "$dir"; then
			# Depth 1: directory has project markers — register it directly
			new_projects=$(register_project "$new_projects" "$name" "$dir")
		else
			# Depth 2: no markers — treat as container dir, scan its children
			for subdir in "${dir%/}"/*/; do
				[ -d "$subdir" ] || continue
				local subname
				subname=$(basename "$subdir")
				is_excluded "$subname" && continue
				new_projects=$(register_project "$new_projects" "$subname" "$subdir")
			done
		fi
	done

	# Read existing projects.json (or empty array if missing/invalid)
	local existing="[]"
	if [ -f "$PROJECTS_FILE" ] && jq empty "$PROJECTS_FILE" 2>/dev/null; then
		existing=$(cat "$PROJECTS_FILE")
	fi

	# Separate user entries (no "auto" tag) from auto entries
	local user_entries
	user_entries=$(echo "$existing" | jq '[.[] | select(.tags | index("auto") | not)]')

	# Merge: user entries + new auto-detected entries
	local merged
	merged=$(jq -n --argjson user "$user_entries" --argjson auto "$new_projects" '$user + $auto')

	# Only write if content changed (avoid unnecessary file writes that trigger Project Manager reloads)
	local current_hash new_hash
	current_hash=""
	[ -f "$PROJECTS_FILE" ] && current_hash=$(md5sum "$PROJECTS_FILE" 2>/dev/null | cut -d' ' -f1)

	local tmp_file
	tmp_file=$(mktemp)
	echo "$merged" | jq '.' >"$tmp_file"
	new_hash=$(md5sum "$tmp_file" | cut -d' ' -f1)

	if [ "$current_hash" != "$new_hash" ]; then
		mv "$tmp_file" "$PROJECTS_FILE"
		chmod 644 "$PROJECTS_FILE"
		local count
		count=$(echo "$merged" | jq 'length')
		echo "$LOG_PREFIX Updated projects.json ($count projects)"
	else
		rm -f "$tmp_file"
	fi
}

stop_watcher() {
	if [ -f "$PID_FILE" ]; then
		local old_pid
		old_pid=$(cat "$PID_FILE" 2>/dev/null)
		if [ -n "$old_pid" ]; then
			# Kill the process group to stop both the subshell and inotifywait pipeline
			kill -- -"$old_pid" 2>/dev/null || kill "$old_pid" 2>/dev/null || true
		fi
		rm -f "$PID_FILE"
	fi
}

start_watcher() {
	# Guard: don't start if already running
	if [ -f "$PID_FILE" ]; then
		local old_pid
		old_pid=$(cat "$PID_FILE" 2>/dev/null)
		if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
			echo "$LOG_PREFIX Watcher already running (PID $old_pid), skipping"
			return 0
		fi
		# Stale PID file — clean up
		stop_watcher
	fi

	# Check if inotifywait is available
	if ! command -v inotifywait &>/dev/null; then
		echo "$LOG_PREFIX Installing inotify-tools..."
		if command -v sudo &>/dev/null; then
			sudo apt-get update -qq && sudo apt-get install -y -qq inotify-tools >/dev/null 2>&1
		else
			apt-get update -qq && apt-get install -y -qq inotify-tools >/dev/null 2>&1
		fi

		if ! command -v inotifywait &>/dev/null; then
			echo "$LOG_PREFIX WARNING: Could not install inotify-tools, watcher disabled"
			return 1
		fi
		echo "$LOG_PREFIX inotify-tools installed"
	fi

	# Fork background watcher in its own process group for clean shutdown
	set -m
	(
		# Watch for directory create/delete/move events recursively under /workspaces/
		# -r watches subdirectories (catches events inside container dirs like projects/)
		# --exclude filters noisy dirs that generate frequent irrelevant events
		inotifywait -m -r -q -e create,delete,moved_to,moved_from \
			--exclude '(node_modules|\.git/|\.tmp|__pycache__|\.venv)' \
			--format '%w%f %e' "$WORKSPACE_ROOT" 2>/dev/null |
			while read -r _path event; do
				# Small delay to let filesystem settle (e.g., move operations)
				sleep 1
				scan_and_update
			done

		# Cleanup on exit
		rm -f "$PID_FILE"
	) &
	local watcher_pid=$!
	set +m
	echo "$watcher_pid" >"$PID_FILE"
	disown

	echo "$LOG_PREFIX Background watcher started (PID $watcher_pid)"
}

# --- Main ---

echo "$LOG_PREFIX Configuring Project Manager auto-detection..."

# Ensure projects directory exists
mkdir -p "$PROJECTS_DIR"

# Initial scan (synchronous — runs in <1 second)
scan_and_update

# Start background watcher
start_watcher

echo "$LOG_PREFIX Done"
