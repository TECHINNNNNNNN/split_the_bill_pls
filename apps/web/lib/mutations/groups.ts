import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CreateGroup, StartGroupSplit } from "@pladuk/shared/schemas";

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

export function useStartGroupSplit(groupId: string) {
  return useMutation({
    mutationFn: async (data: StartGroupSplit) => {
      const res = await api.api.groups[":id"].split.$post({
        param: { id: groupId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to start split");
      return res.json();
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const res = await api.api.groups.join[":code"].$post({
        param: { code },
      });
      if (!res.ok) throw new Error("Failed to join group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.api.groups[":id"].$delete({
        param: { id: groupId },
      });
      if (!res.ok) throw new Error("Failed to delete group");
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
