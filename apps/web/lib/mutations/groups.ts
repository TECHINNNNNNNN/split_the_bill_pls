import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CreateGroup, AddGroupMember } from "@pladuk/shared/schemas";

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGroup) => {
      const res = await api.api.groups.$post({ json: data });
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddGroupMember) => {
      const res = await api.api.groups[":id"].members.$post({
        param: { id: groupId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to add member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useDeleteGroupMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await api.api.groups[":id"].members[":memberId"].$delete({
        param: { id: groupId, memberId },
      });
      if (!res.ok) throw new Error("Failed to remove member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
