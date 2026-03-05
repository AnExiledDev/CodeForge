export interface ManifestEntry {
	src: string;
	dest: string;
	destFilename?: string;
	enabled?: boolean;
	overwrite: "if-changed" | "always" | "never";
}

export interface SettingsJson {
	enabledPlugins?: Record<string, boolean>;
	env?: Record<string, string>;
	permissions?: {
		allow?: string[];
		deny?: string[];
		ask?: string[];
	};
	[key: string]: unknown;
}
