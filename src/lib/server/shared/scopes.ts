export const SCOPES = {
  AUTH: "auth",
  USER_READ: "user:read",
  USER: "user",
  ADMIN_READ: "admin:read",
  ADMIN: "admin",
} as const;

export type ScopeValue = (typeof SCOPES)[keyof typeof SCOPES];

export function scopeExplanation(scope: string): string {
  switch (scope) {
    case SCOPES.USER_READ:
      return "Read user data including passports.";
    case SCOPES.USER:
      return "Write user data including passports.";
    case SCOPES.ADMIN_READ:
      return "Read ALL user data including passports.";
    case SCOPES.ADMIN:
      return "Write ALL user data including passports.";
    default:
      return "";
  }
}

export function parseScopes(scopeString: string): string[] {
  return scopeString
    .split(/\s+/)
    .filter((s) => s.length > 0);
}

export function hasScope(grantedScopes: string[], required: ScopeValue): boolean {
  return grantedScopes.includes(required);
}
