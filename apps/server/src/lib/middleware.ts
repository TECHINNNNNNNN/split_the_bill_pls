import { createMiddleware } from "hono/factory";
import { auth } from "./auth.js";

type Session = typeof auth.$Infer.Session

export const requireAuth = createMiddleware<{
    Variables: {
        user: Session["user"]
        session: Session["session"]
    }
}>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    })

    if (!session) {
        return c.json({ error : "Unauthorized" }, 401)
    }

    c.set("user", session.user)
    c.set("session", session.session)
    await next()
})