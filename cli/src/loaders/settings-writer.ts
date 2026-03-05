import { loadSettings, writeSettings } from "./config-loader.js";
import { findSettingsPaths } from "./plugin-loader.js";

export async function setPluginEnabled(
	qualifiedName: string,
	enabled: boolean,
): Promise<{ deployed: boolean; source: boolean }> {
	const paths = findSettingsPaths();
	const result = { deployed: false, source: false };

	// Update deployed settings
	try {
		const settings = await loadSettings(paths.deployed);
		if (!settings.enabledPlugins) {
			settings.enabledPlugins = {};
		}
		settings.enabledPlugins[qualifiedName] = enabled;
		await writeSettings(paths.deployed, settings);
		result.deployed = true;
	} catch {}

	// Update source settings if it exists
	if (paths.source) {
		try {
			const settings = await loadSettings(paths.source);
			if (!settings.enabledPlugins) {
				settings.enabledPlugins = {};
			}
			settings.enabledPlugins[qualifiedName] = enabled;
			await writeSettings(paths.source, settings);
			result.source = true;
		} catch {}
	}

	return result;
}
