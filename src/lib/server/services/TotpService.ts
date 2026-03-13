import { Effect } from "effect";
import { TotpError } from "../effect/errors.js";
import * as OTPAuth from "otpauth";

export function validateTotp(userId: number, secret: string, code: string) {
  return Effect.try({
    try: () => {
      const totp = new OTPAuth.TOTP({
        issuer: "Purdue Hackers",
        label: String(userId),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      return delta !== null;
    },
    catch: (e) => new TotpError({ message: `TOTP validation failed: ${e}` }),
  });
}
