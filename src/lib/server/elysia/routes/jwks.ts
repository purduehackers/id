import Elysia from "elysia";
import { getPublicJwk } from "../../jwt/index.js";

export const jwksRoute = new Elysia().get("/jwks", () => {
  const publicJwk = getPublicJwk();
  return { keys: [publicJwk] };
});
