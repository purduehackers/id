import Elysia from "elysia";
import { authorizeRoute } from "./routes/authorize.js";
import { tokenRoute } from "./routes/token.js";
import { jwksRoute } from "./routes/jwks.js";
import { userRoute } from "./routes/user.js";
import { scanRoute } from "./routes/scan.js";
import { doorRoute } from "./routes/door.js";
import { newRoute } from "./routes/new.js";
import { passportRoute } from "./routes/passport.js";
import { passportIdRoute } from "./routes/passportId.js";

export const elysiaApp = new Elysia({ prefix: "/api" })
  .use(authorizeRoute)
  .use(tokenRoute)
  .use(jwksRoute)
  .use(userRoute)
  .use(scanRoute)
  .use(doorRoute)
  .use(newRoute)
  .use(passportRoute)
  .use(passportIdRoute);
