#!/bin/bash
# Copy configuration files to workspace based on file-manifest.json

CONFIG_DIR="${CONFIG_SOURCE_DIR:?CONFIG_SOURCE_DIR not set}"
MANIFEST="$CONFIG_DIR/file-manifest.json"

log()  { echo "[setup-config] $*"; }
warn() { echo "[setup-config] WARNING: $*"; }
err()  { echo "[setup-config] ERROR: $*" >&2; }

# Deprecation notice if legacy OVERWRITE_CONFIG is still set
if [ -n "${OVERWRITE_CONFIG+x}" ]; then
    warn "OVERWRITE_CONFIG is deprecated. Use per-file 'overwrite' in config/file-manifest.json instead."
fi

# ── Legacy fallback ──────────────────────────────────────────────
legacy_copy() {
    local target_dir="${CLAUDE_CONFIG_DIR:?CLAUDE_CONFIG_DIR not set}"
    warn "file-manifest.json not found, falling back to legacy copy"
    mkdir -p "$target_dir"
    for file in defaults/settings.json defaults/keybindings.json defaults/main-system-prompt.md; do
        if [ -f "$CONFIG_DIR/$file" ]; then
            local basename="${file##*/}"
            cp "$CONFIG_DIR/$file" "$target_dir/$basename"
            chown "$(id -un):$(id -gn)" "$target_dir/$basename" 2>/dev/null || true
            log "Copied $basename (legacy)"
        fi
    done
    log "Configuration complete (legacy)"
}

if [ ! -f "$MANIFEST" ]; then
    legacy_copy
    exit 0
fi

# ── Validate manifest JSON ──────────────────────────────────────
if ! jq empty "$MANIFEST" 2>/dev/null; then
    err "Invalid JSON in file-manifest.json"
    exit 1
fi

# ── Variable expansion ───────────────────────────────────────────
expand_vars() {
    local val="$1"
    val="${val//\$\{CLAUDE_CONFIG_DIR\}/$CLAUDE_CONFIG_DIR}"
    val="${val//\$\{WORKSPACE_ROOT\}/$WORKSPACE_ROOT}"
    # Warn on any remaining unresolved ${...} tokens
    if [[ "$val" =~ \$\{[^}]+\} ]]; then
        warn "Unresolved variable in: $val"
    fi
    echo "$val"
}

# ── Change detection ─────────────────────────────────────────────
should_copy() {
    local src="$1" dest="$2"
    [ ! -f "$dest" ] && return 0
    local src_hash dest_hash
    src_hash=$(sha256sum "$src" | cut -d' ' -f1)
    dest_hash=$(sha256sum "$dest" | cut -d' ' -f1)
    [ "$src_hash" != "$dest_hash" ]
}

# ── Process manifest ─────────────────────────────────────────────
log "Copying configuration files..."

# Single jq invocation to extract all fields (reduces N×5 subprocess calls to 1)
jq -r '.[] | [.src, .dest, (.destFilename // ""), (.enabled // true | tostring), (.overwrite // "if-changed")] | @tsv' "$MANIFEST" |
while IFS=$'\t' read -r src dest dest_filename enabled overwrite; do
    # Skip disabled entries
    if [ "$enabled" = "false" ]; then
        log "Skipping $src (disabled)"
        continue
    fi

    # Resolve paths
    src_path="$CONFIG_DIR/$src"
    dest_dir=$(expand_vars "$dest")
    filename="${dest_filename:-${src##*/}}"
    dest_path="$dest_dir/$filename"

    # Validate source exists
    if [ ! -f "$src_path" ]; then
        warn "$src not found in config dir, skipping"
        continue
    fi

    # Ensure destination directory exists
    mkdir -p "$dest_dir"

    # Apply overwrite strategy
    case "$overwrite" in
        always)
            cp "$src_path" "$dest_path"
            log "Copied $src → $dest_path (always)"
            ;;
        never)
            if [ ! -f "$dest_path" ]; then
                cp "$src_path" "$dest_path"
                log "Copied $src → $dest_path (new)"
            else
                log "Skipping $src (exists, overwrite=never)"
            fi
            ;;
        if-changed|*)
            if should_copy "$src_path" "$dest_path"; then
                cp "$src_path" "$dest_path"
                log "Copied $src → $dest_path (changed)"
            else
                log "Skipping $src (unchanged)"
            fi
            ;;
    esac

    # Fix ownership
    chown "$(id -un):$(id -gn)" "$dest_path" 2>/dev/null || true
done

log "Configuration complete"
