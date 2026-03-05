import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const billQueries = {
  detail: (billId: string) =>
    queryOptions({
      queryKey: ["bills", billId] as const,
      queryFn: async () => {
        const res = await api.api.bills[":id"].$get({
          param: { id: billId },
        });
        if (!res.ok) throw new Error("Bill not found");
        return res.json();
      },
      enabled: !!billId,
    }),
};
