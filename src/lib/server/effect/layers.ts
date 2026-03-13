import { Context, Effect, Layer } from "effect";
import type { Db } from "../db/index.js";
import type { Kv } from "../kv/index.js";

// Service tags
export class DbService extends Context.Tag("DbService")<
  DbService,
  Db
>() {}

export class KvService extends Context.Tag("KvService")<
  KvService,
  Kv
>() {}

export interface JwtOps {
  sign(claims: import("../jwt/index.js").TokenClaims): Promise<string>;
  verify(
    token: string,
    issuer: string,
  ): Promise<import("../jwt/index.js").TokenClaims>;
  getPublicJwk(): Record<string, unknown>;
}

export class JwtService extends Context.Tag("JwtService")<
  JwtService,
  JwtOps
>() {}

// Live layers
export const DbLive = (db: Db) => Layer.succeed(DbService, db);

export const KvLive = (kv: Kv) => Layer.succeed(KvService, kv);

export const JwtLive = (ops: JwtOps) => Layer.succeed(JwtService, ops);
