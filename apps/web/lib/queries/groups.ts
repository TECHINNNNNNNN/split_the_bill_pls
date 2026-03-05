import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const groupQueries = {
  all: () =>
    queryOptions({
      queryKey: ["groups"] as const,
      queryFn: async () => {
        const res = await api.api.groups.$get();
        if (!res.ok) throw new Error("Failed to fetch groups");
        return res.json();
      },
    }),

  detail: (groupId: string) =>
    queryOptions({
      queryKey: ["groups", groupId] as const,
      queryFn: async () => {
        const res = await api.api.groups[":id"].$get({
          param: { id: groupId },
        });
        if (!res.ok) throw new Error("Group not found");
        return res.json();
      },
      enabled: !!groupId,
    }),
};
