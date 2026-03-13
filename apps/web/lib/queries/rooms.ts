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
