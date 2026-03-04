const RELATIVE_TIME_REGEX =
	/^(\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months)\s+ago$/i;

const UNIT_TO_MS: Record<string, number> = {
	second: 1000,
	seconds: 1000,
	minute: 60 * 1000,
	minutes: 60 * 1000,
	hour: 60 * 60 * 1000,
	hours: 60 * 60 * 1000,
	day: 24 * 60 * 60 * 1000,
	days: 24 * 60 * 60 * 1000,
	week: 7 * 24 * 60 * 60 * 1000,
	weeks: 7 * 24 * 60 * 60 * 1000,
	month: 30 * 24 * 60 * 60 * 1000,
	months: 30 * 24 * 60 * 60 * 1000,
};

export function parseRelativeTime(input: string): Date | null {
	const trimmed = input.trim();
	const match = trimmed.match(RELATIVE_TIME_REGEX);
	if (!match) return null;

	const amount = parseInt(match[1], 10);
	const unit = match[2].toLowerCase();
	const ms = UNIT_TO_MS[unit];
	if (ms === undefined) return null;

	return new Date(Date.now() - amount * ms);
}

export function parseTime(input: string): Date | null {
	// Try relative first
	const relative = parseRelativeTime(input);
	if (relative) return relative;

	// Try absolute
	const date = new Date(input);
	if (isNaN(date.getTime())) return null;
	return date;
}
