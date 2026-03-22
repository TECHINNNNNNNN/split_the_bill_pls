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
};
