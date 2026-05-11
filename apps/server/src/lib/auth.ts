import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "../db/index.js";

export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [process.env.FRONTEND_URL!],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        },
        line: {
            clientId: process.env.LINE_CLIENT_ID!,
            clientSecret: process.env.LINE_CLIENT_SECRET!,
            scope: ["openid", "profile", "email"],
        },
        gitlab: {
            clientId: process.env.GITLAB_CLIENT_ID!,
            clientSecret: process.env.GITLAB_CLIENT_SECRET!,
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github", "discord", "line", "gitlab"],
        },
    },
    emailAndPassword: { enabled: true },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // re-check session against DB every 5 minutes
        },
    },
    plugins: [bearer()],
    user: {
        additionalFields: {
            promptpayId: { type: "string", required: false, input: true },
            promptpayType: { type: "string", required: false, input: true },
        },
    },
})