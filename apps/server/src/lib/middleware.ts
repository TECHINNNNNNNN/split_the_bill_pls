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

export const optionalAuth = createMiddleware<{
    Variables: {
        user: Session["user"] | null
        session: Session["session"] | null
    }
}>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    })

    c.set("user", session?.user ?? null)
    c.set("session", session?.session ?? null)
    await next()
})