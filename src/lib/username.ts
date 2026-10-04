export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;
export const USERNAME_PATTERN = /^[a-z0-9]+$/;

export function normalizeUsername(raw: string) {
	return raw.trim().toLowerCase();
}

export function usernameProblem(username: string): string | null {
	if (username.length < USERNAME_MIN_LENGTH) {
		return `Usernames need at least ${USERNAME_MIN_LENGTH} characters.`;
	}
	if (username.length > USERNAME_MAX_LENGTH) {
		return `Usernames can have at most ${USERNAME_MAX_LENGTH} characters.`;
	}
	if (!USERNAME_PATTERN.test(username)) return 'Usernames can only have letters and numbers.';
	return null;
}
