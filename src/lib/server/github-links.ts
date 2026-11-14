/** Deliberately project native IDs and timestamps, never OAuth tokens. */
export type LinkedGitHubAccount = {
	accountId: string;
	createdAt: Date;
	updatedAt: Date;
};

export function githubAccount(account: LinkedGitHubAccount) {
	return {
		id: account.accountId,
		linked_at: account.createdAt.toISOString(),
		updated_at: account.updatedAt.toISOString()
	};
}

export function githubAccountsClaim(scopes: Set<string>, accounts: LinkedGitHubAccount[]) {
	return scopes.has('directory:github') ? { github_accounts: accounts.map(githubAccount) } : {};
}

export function githubLinkEvent(
	scopes: Set<string>,
	user: Record<string, unknown>,
	account: LinkedGitHubAccount
) {
	return scopes.has('github') ? { user, github_account: githubAccount(account) } : null;
}
