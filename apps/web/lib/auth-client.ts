import { createAuthClient } from "better-auth/react";

const TOKEN_KEY = "bearer_token";

export const { signIn, signOut, useSession } = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem(TOKEN_KEY) || "",
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
    },
  },
});
