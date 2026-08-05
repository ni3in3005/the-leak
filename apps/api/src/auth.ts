import { verifyToken } from "@clerk/backend";
import { createMiddleware } from "hono/factory";
import type { AuthVariables, Env } from "./env";

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing authorization token" }, 401);
    }

    const token = authHeader.slice(7);
    const secretKey = c.env.CLERK_SECRET_KEY;
    if (!secretKey || secretKey.includes("REPLACE")) {
      return c.json(
        { error: "CLERK_SECRET_KEY is not configured on the Worker" },
        500
      );
    }

    try {
      const payload = await verifyToken(token, {
        secretKey,
        // Optional: authorizedParties can restrict token aud; omit for flexible local/prod origins
      });
      const userId = payload.sub;
      if (!userId) {
        return c.json({ error: "Invalid token" }, 401);
      }
      c.set("userId", userId);
      await next();
    } catch (err) {
      console.error("Clerk verifyToken failed", err);
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
);
