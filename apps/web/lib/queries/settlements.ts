import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const settlementQueries = {
  balances: () =>
    queryOptions({
      queryKey: ["settlements", "balances"],
      queryFn: async () => {
        const res = await api.api.settlements.balances.$get();
        if (!res.ok) throw new Error("Failed to fetch balances");
        return res.json();
      },
      staleTime: 0,
      refetchOnMount: "always" as const,
    }),
  pending: () =>
    queryOptions({
      queryKey: ["settlements", "pending"],
      queryFn: async () => {
        const res = await api.api.settlements.pending.$get();
        if (!res.ok) throw new Error("Failed to fetch pending settlements");
        return res.json();
      },
      staleTime: 0,
      refetchOnMount: "always" as const,
    }),
  insights: () =>
    queryOptions({
      queryKey: ["settlements", "insights"],
      queryFn: async () => {
        const res = await api.api.settlements.insights.$get();
        if (!res.ok) throw new Error("Failed to fetch insights");
        return res.json();
      },
      staleTime: 5 * 60 * 1000,
      refetchOnMount: false,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: ["settlements", id],
      queryFn: async () => {
        const res = await api.api.settlements[":id"].$get({ param: { id } });
        if (!res.ok) throw new Error("Failed to fetch settlement");
        return res.json();
      },
      enabled: !!id,
    }),
};
