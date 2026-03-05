import { homedir } from "os";
import { basename, resolve } from "path";

/**
 * Normalize a path to use forward slashes.
 * Forward slashes work on all platforms including Windows.
 */
export function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

/**
 * Cross-platform home directory with normalized path.
 */
export function getHome(): string {
	return normalizePath(homedir());
}

/**
 * path.resolve() with forward-slash normalization.
 */
export function resolveNormalized(...segments: string[]): string {
	return normalizePath(resolve(...segments));
}

/**
 * Extract filename from a path using path.basename().
 */
export function basenameFromPath(filePath: string): string {
	return basename(normalizePath(filePath));
}
