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
