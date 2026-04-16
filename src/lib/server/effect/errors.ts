import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
  cause: unknown;
}> {}

export class KvError extends Data.TaggedError("KvError")<{
  cause: unknown;
}> {}

export class JwtError extends Data.TaggedError("JwtError")<{
  cause: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  entity: string;
  id?: string | number;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  message: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  message: string;
}> {}

export class BadRequestError extends Data.TaggedError("BadRequestError")<{
  message: string;
}> {}

export class PassportDisabledError extends Data.TaggedError(
  "PassportDisabledError",
)<{
  passportId: number;
}> {}

export class TotpError extends Data.TaggedError("TotpError")<{
  message: string;
}> {}

export type AppError =
  | DbError
  | KvError
  | JwtError
  | NotFoundError
  | UnauthorizedError
  | ForbiddenError
  | BadRequestError
  | PassportDisabledError
  | TotpError;

/** Map an Effect tagged error to an HTTP status code. Unknown errors become 500. */
export function errorToStatus(e: unknown): number {
  const tag = (e as { _tag?: string })?._tag;
  switch (tag) {
    case "UnauthorizedError":
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

/** Get a safe error message from a tagged error. Hides details for 500s. */
export function errorMessage(e: unknown): string {
  const status = errorToStatus(e);
  if (status === 500) return "Internal server error";
  return (e as { message?: string })?.message ?? "Unknown error";
}
