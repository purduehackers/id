export interface StaticClient {
  clientId: string;
  url: string;
  scope: string;
  name: string;
}

export const STATIC_CLIENTS: StaticClient[] = [
  {
    clientId: "id-dash",
    url: "https://id.purduehackers.com/dash",
    scope: "user:read user",
    name: "ID Dashboard",
  },
  {
    clientId: "dashboard",
    url: "https://dash.purduehackers.com/api/callback",
    scope: "user:read",
    name: "Dashboard",
  },
  {
    clientId: "passports",
    url: "https://passports.purduehackers.com/callback",
    scope: "user:read user",
    name: "Passports",
  },
  {
    clientId: "authority",
    url: "authority://callback",
    scope: "admin:read admin",
    name: "Passport Authority",
  },
  {
    clientId: "auth-test",
    url: "https://id-auth.purduehackers.com/api/auth/callback/purduehackers-id",
    scope: "user:read",
    name: "Auth Test",
  },
  {
    clientId: "vulcan-auth",
    url: "https://auth.purduehackers.com/source/oauth/callback/purduehackers-id/",
    scope: "user:read",
    name: "Vulcan Auth",
  },
];
