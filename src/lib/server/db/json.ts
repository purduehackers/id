export function readList(value: unknown): string[] {
	const parsed = typeof value === 'string' ? JSON.parse(value) : value;
	return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function writeList(list: string[]): string {
	return JSON.stringify(list);
}
