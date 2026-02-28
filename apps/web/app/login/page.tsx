"use client"

import { signIn } from "@/lib/auth-client"

export default function LoginPage() {
    const handleGoogleSignIn = () => {
        signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/dashboard`
        })
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <button
                onClick={handleGoogleSignIn}
                className="px-6 py-3 bg-white text-gray-700 border-gray-300 rounded-lg font-medium hover:bg-gray-50 cursor-pointer"
           >
                Sign in with Google
            </button>
        </div>
    )
}