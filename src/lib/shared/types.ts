export interface UserInfo {
  id: number;
  discordId: string;
  role: string;
  name: string | null;
}

export interface ClientResponse {
  id: number;
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string;
  isConfidential: boolean;
  createdAt: string;
}

export interface ClientCreatedResponse extends ClientResponse {
  clientSecret: string | null;
}

export interface CreateClientRequest {
  name: string;
  redirectUris: string[];
  scopes: string[];
  isConfidential: boolean;
}

export interface PublicPassport {
  id: number;
  version: number;
  surname: string;
  name: string;
  dateOfBirth: string;
  dateOfIssue: string;
  placeOfOrigin: string;
}

export interface UserWithPassport {
  iss: string;
  sub: number;
  id: number;
  discord_id: string;
  role: string;
  latest_passport: PublicPassport | null;
}
