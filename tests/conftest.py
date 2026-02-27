"""Conftest for plugin tests.

Loads plugin scripts by absolute path since they don't have package structure.
Each module is loaded once and cached by importlib.
"""

import importlib.util
from pathlib import Path

# Root of the plugin scripts
PLUGINS_ROOT = (
    Path(__file__).resolve().parent.parent
    / ".devcontainer"
    / "plugins"
    / "devs-marketplace"
    / "plugins"
)


def _load_script(plugin_name: str, script_name: str):
    """Load a plugin script as a Python module.

    Args:
        plugin_name: Plugin directory name (e.g. "dangerous-command-blocker")
        script_name: Script filename (e.g. "block-dangerous.py")

    Returns:
        The loaded module.
    """
    script_path = PLUGINS_ROOT / plugin_name / "scripts" / script_name
    if not script_path.exists():
        raise FileNotFoundError(f"Plugin script not found: {script_path}")

    # Convert filename to valid module name
    module_name = script_name.replace("-", "_").replace(".py", "")
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    module = importlib.util.module_from_spec(spec)

    spec.loader.exec_module(module)

    return module


# Pre-load all tested plugin modules
block_dangerous = _load_script("dangerous-command-blocker", "block-dangerous.py")
guard_workspace_scope = _load_script(
    "workspace-scope-guard", "guard-workspace-scope.py"
)
guard_protected = _load_script("protected-files-guard", "guard-protected.py")
guard_protected_bash = _load_script("protected-files-guard", "guard-protected-bash.py")
guard_readonly_bash = _load_script("agent-system", "guard-readonly-bash.py")
redirect_builtin_agents = _load_script("agent-system", "redirect-builtin-agents.py")
