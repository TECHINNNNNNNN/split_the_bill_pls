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
        }
    },
    emailAndPassword: { enabled: true },
    plugins: [bearer()],
    user: {
        additionalFields: {
            promptpayId: { type: "string", required: false, input: true },
            promptpayType: { type: "string", required: false, input: true },
        },
    },
})