import { Effect, Exit, Cause, Option, Layer, ManagedRuntime } from "effect";
import { db } from "../db/index.js";
import { kv } from "../kv/index.js";
import { signJwt, verifyJwt, getPublicJwk } from "../jwt/index.js";
import {
  DbLive,
  KvLive,
  JwtLive,
  type JwtOps,
} from "./layers.js";
import type { AppError } from "./errors.js";

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

type AppLayer = typeof MainLayer extends Layer.Layer<infer R, any, any> ? R : never;

export const appRuntime = ManagedRuntime.make(MainLayer);

export function runEffect<A, E>(
  effect: Effect.Effect<A, E, AppLayer>,
): Promise<A> {
  return appRuntime.runPromise(effect) as Promise<A>;
}

function errorToStatus(e: AppError): number {
  switch (e._tag) {
    case "UnauthorizedError":
    case "JwtError":
      return 401;
    case "ForbiddenError":
    case "PassportDisabledError":
      return 403;
    case "NotFoundError":
      return 404;
    case "BadRequestError":
    case "TotpError":
      return 400;
    default:
      return 500;
  }
}

function errorToMessage(e: AppError): string {
  switch (e._tag) {
    case "JwtError":
      return "Invalid or expired token";
    case "DbError":
    case "KvError":
      return "Internal server error";
    default:
      return (e as { message?: string }).message ?? "Unknown error";
  }
}

export type RouteError = { status: number; error: string };
export type RouteResult<A> = { ok: true; data: A } | { ok: false } & RouteError;

/** Run an effect as a route handler. Errors are captured via Exit, not thrown. */
export async function runRoute<A>(
  effect: Effect.Effect<A, AppError, AppLayer>,
): Promise<RouteResult<A>> {
  const exit = await appRuntime.runPromise(Effect.exit(effect));
  if (Exit.isSuccess(exit)) {
    return { ok: true, data: exit.value };
  }
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    return { ok: false, status: errorToStatus(failure.value), error: errorToMessage(failure.value) };
  }
  return { ok: false, status: 500, error: "Internal server error" };
}
