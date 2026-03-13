import * as jose from "jose";

let jwkData: Record<string, any> | null = null;
let privateKey: CryptoKey | Uint8Array | null = null;
let publicKey: CryptoKey | Uint8Array | null = null;
let keysReady: Promise<void> | null = null;

function getJwkData() {
  if (!jwkData) {
    const jwkString = process.env.JWK;
    if (!jwkString) {
      throw new Error("JWK environment variable is required");
    }
    jwkData = JSON.parse(jwkString);
  }
  return jwkData!;
}

async function initKeys() {
  const data = getJwkData();
  privateKey = await jose.importJWK(data, "ES256");
  const { d: _, ...publicJwk } = data;
  publicKey = await jose.importJWK(publicJwk, "ES256");
}

function ensureKeysReady() {
  if (!keysReady) {
    keysReady = initKeys();
  }
  return keysReady;
}

export async function getPrivateKey(): Promise<CryptoKey | Uint8Array> {
  await ensureKeysReady();
  return privateKey!;
}

export async function getPublicKey(): Promise<CryptoKey | Uint8Array> {
  await ensureKeysReady();
  return publicKey!;
}

export function getPublicJwk(): Record<string, unknown> {
  const data = getJwkData();
  const { d: _, ...publicJwk } = data;
  return publicJwk;
}

export interface TokenClaims {
  sub: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
  scope: string;
  redirect_uri?: string;
}

export async function signJwt(claims: TokenClaims): Promise<string> {
  const key = await getPrivateKey();
  return new jose.SignJWT(claims as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "ES256" })
    .sign(key);
}

export async function verifyJwt(
  token: string,
  issuer: string,
): Promise<TokenClaims> {
  const key = await getPublicKey();
  const { payload } = await jose.jwtVerify(token, key, { issuer });
  return payload as unknown as TokenClaims;
}
