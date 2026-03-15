import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const roomQueries = {
  byCode: (code: string) =>
    queryOptions({
      queryKey: ["rooms", "code", code] as const,
      queryFn: async () => {
        const res = await api.api.rooms.code[":code"].$get({
          param: { code },
        });
        if (!res.ok) throw new Error("Room not found");
        return res.json();
      },
      enabled: !!code,
    }),

  my: () =>
    queryOptions({
      queryKey: ["rooms", "my"] as const,
      queryFn: async () => {
        const res = await api.api.rooms.my.$get();
        if (!res.ok) throw new Error("Failed to fetch your rooms");
        return res.json();
      },
    }),

  invites: () =>
    queryOptions({
      queryKey: ["rooms", "invites"] as const,
      queryFn: async () => {
        const res = await api.api.rooms.invites.$get();
        if (!res.ok) throw new Error("Failed to fetch invites");
        return res.json();
      },
    }),

  detail: (roomId: string) =>
    queryOptions({
      queryKey: ["rooms", roomId] as const,
      queryFn: async () => {
        const res = await api.api.rooms[":id"].$get({
          param: { id: roomId },
        });
        if (!res.ok) throw new Error("Room not found");
        return res.json();
      },
      enabled: !!roomId,
    }),
};
