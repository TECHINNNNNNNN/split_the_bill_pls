import { Hono } from "hono";
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { db } from "./db/index.js"
import { sql } from "drizzle-orm"
import { auth } from "./lib/auth.js";

const app = new Hono().basePath("/api")


app.use(logger())
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
        exposeHeaders: ["set-auth-token"]
    })
)

app.on(["POST", "GET"], "/auth/**", (c) => {
    return auth.handler(c.req.raw)
})

const routes = app.get("/health", async (c) => {
    try {
        await db.execute(sql`SELECT 1`)
        return c.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() })
    } catch {
        return c.json({ status: "error", database: "disconnected", timestamp: new Date().toISOString() }, 500)
    }
})

export type AppType = typeof routes
export default app;