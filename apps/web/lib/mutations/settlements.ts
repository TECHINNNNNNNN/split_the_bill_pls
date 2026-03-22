import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useClaimSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      otherUserId: string;
      slipImage?: string;
      transRef?: string;
      sendingBank?: string;
    }) => {
      const res = await api.api.settlements.claim.$post({ json: data });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error ?? "Claim failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
    },
  });
}

export function useConfirmSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settlementId: string) => {
      const res = await api.api.settlements[":id"].confirm.$patch({
        param: { id: settlementId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error ?? "Confirm failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useRejectSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settlementId: string) => {
      const res = await api.api.settlements[":id"].reject.$patch({
        param: { id: settlementId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error ?? "Reject failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
    },
  });
}
