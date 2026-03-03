import { hc } from "hono/client";
import type { AppType } from "@pladuk/server/src/app.js";


export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!);
