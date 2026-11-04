const BROWSERS: [RegExp, string][] = [
	[/\bEdg(e|A|iOS)?\//, 'Edge'],
	[/\b(OPR|Opera)\//, 'Opera'],
	[/\bVivaldi\//, 'Vivaldi'],
	[/\bSamsungBrowser\//, 'Samsung Internet'],
	[/\b(Firefox|FxiOS)\//, 'Firefox'],
	[/\b(Chrome|CriOS|Chromium)\//, 'Chrome'],
	[/\bSafari\//, 'Safari']
];

const SYSTEMS: [RegExp, string][] = [
	[/\biPhone\b/, 'iPhone'],
	[/\biPad\b/, 'iPad'],
	[/\bAndroid\b/, 'Android'],
	[/\bWindows\b/, 'Windows'],
	[/\bCrOS\b/, 'ChromeOS'],
	[/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
	[/\bLinux\b/, 'Linux']
];

const match = (agent: string, table: [RegExp, string][]) =>
	table.find(([pattern]) => pattern.test(agent))?.[1];

export function describeUserAgent(agent: string | null | undefined): string {
	if (!agent) return 'Unknown device';
	const browser = match(agent, BROWSERS);
	const system = match(agent, SYSTEMS);
	if (browser && system) return `${browser} on ${system}`;
	return browser ?? system ?? 'Unknown device';
}
