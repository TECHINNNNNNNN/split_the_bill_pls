import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useSettleUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      otherUserId: string;
      slipImage?: string;
      transRef?: string;
      sendingBank?: string;
    }) => {
      const res = await api.api.settlements.settle.$post({ json: data });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error ?? "Settlement failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}
