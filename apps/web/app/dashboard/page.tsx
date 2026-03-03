"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [dbStatus, setDbStatus] = useState<string>("checking...");

  useEffect(() => {
    api.api.health.$get().then(async (res) => {
      const data = await res.json();
      setDbStatus(data.database);
    });
  }, []);

  if (isPending) return <div className="p-8">Loading...</div>;
  if (!session) return <div className="p-8">Not logged in</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {session.user.image && (
        <img src={session.user.image} alt="avatar" className="w-16 h-16 rounded-full" />
      )}
      <h1 className="text-2xl font-bold">{session.user.name}</h1>
      <p className="text-gray-500">{session.user.email}</p>
      <p className="text-sm">Database: {dbStatus}</p>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer"
      >
        Sign out
      </button>
    </div>
  );
}
