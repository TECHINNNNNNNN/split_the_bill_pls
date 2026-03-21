import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const { signIn, signOut, useSession, updateUser } = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
  plugins: [
    inferAdditionalFields({
      user: {
        promptpayId: { type: "string", required: false },
        promptpayType: { type: "string", required: false },
      },
    }),
  ],
});
