import { Effect, Layer, ManagedRuntime } from "effect";
import { db } from "../db/index.js";
import { kv } from "../kv/index.js";
import { signJwt, verifyJwt, getPublicJwk } from "../jwt/index.js";
import {
  DbLive,
  KvLive,
  JwtLive,
  type JwtOps,
} from "./layers.js";

const jwtOps: JwtOps = {
  sign: signJwt,
  verify: verifyJwt,
  getPublicJwk,
};

const MainLayer = Layer.mergeAll(
  DbLive(db),
  KvLive(kv),
  JwtLive(jwtOps),
);

export const appRuntime = ManagedRuntime.make(MainLayer);

export function runEffect<A, E>(
  effect: Effect.Effect<A, E, typeof MainLayer extends Layer.Layer<infer R, any, any> ? R : never>,
): Promise<A> {
  return appRuntime.runPromise(effect) as Promise<A>;
}
