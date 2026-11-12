import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { createClient } from "@supabase/supabase-js";
import { canAccessCustomer, canAccessOwner, type VerifiedIdentity } from "./authorization.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use((_, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
if (!supabaseUrl || !publishableKey) {
  throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
}
const auth = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ownerId = process.env.OWNER_SUPABASE_USER_ID;

type AuthenticatedRequest = Request & { identity?: VerifiedIdentity };
async function requireVerifiedIdentity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const bearer = /^Bearer (\S+)$/i.exec(req.header("authorization") ?? "");
  if (!bearer) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    // Claims are cryptographically verified by Supabase, not decoded and trusted blindly.
    const [claimsResult, userResult] = await Promise.all([
      auth.auth.getClaims(bearer[1]),
      auth.auth.getUser(bearer[1]),
    ]);
    const claims = claimsResult.data?.claims;
    const user = userResult.data.user;
    if (
      claimsResult.error ||
      userResult.error ||
      !claims ||
      !user ||
      claims.sub !== user.id
    ) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    const identity: VerifiedIdentity = {
      id: user.id,
      emailConfirmed: Boolean(user.email_confirmed_at),
      assuranceLevel: typeof claims.aal === "string" ? claims.aal : null,
    };
    if (!canAccessCustomer(identity)) {
      res.status(403).json({ error: "Email verification required" });
      return;
    }
    req.identity = identity;
    next();
  } catch {
    res.status(503).json({ error: "Authentication temporarily unavailable" });
  }
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/v1/me", requireVerifiedIdentity, (req: AuthenticatedRequest, res) => {
  res.json({ userId: req.identity!.id, emailVerified: true, owner: canAccessOwner(req.identity!, ownerId) });
});
app.get("/v1/owner/access", requireVerifiedIdentity, (req: AuthenticatedRequest, res) => {
  if (!canAccessOwner(req.identity!, ownerId)) {
    res.status(403).json({ error: "Owner access requires verified MFA" });
    return;
  }
  res.json({ authorized: true });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const port = Number(process.env.PORT || 8080);
app.listen(port, "127.0.0.1", () => {
  console.info(`Identity API listening on port ${port} (loopback only)`);
});
