import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  CreateRoom,
  JoinRoom,
  AddRoomItem,
  SetRoomItemSplits,
  FinalizeRoom,
  SetRoomPaymentMethod,
  RoomStatus,
} from "@pladuk/shared/schemas";

export function useCreateRoom() {
  return useMutation({
    mutationFn: async (data: CreateRoom) => {
      const res = await api.api.rooms.$post({ json: data });
      if (!res.ok) throw new Error("Failed to create room");
      return res.json();
    },
  });
}

export function useJoinRoom(code: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: JoinRoom) => {
      const res = await api.api.rooms.code[":code"].join.$post({
        param: { code },
        json: data,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error || "Failed to join room");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "code", code] });
    },
  });
}

export function useAddPlaceholderMember(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: JoinRoom) => {
      const res = await api.api.rooms[":id"].members.$post({
        param: { id: roomId },
        json: data,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "code"] });
    },
  });
}

export function useRemoveMember(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await api.api.rooms[":id"].members[":memberId"].$delete({
        param: { id: roomId, memberId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error?: string }).error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "code"] });
    },
  });
}

export function useAdvanceRoomStatus(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: RoomStatus) => {
      const res = await api.api.rooms[":id"].status.$patch({
        param: { id: roomId },
        json: { status },
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useAddRoomItem(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddRoomItem) => {
      const res = await api.api.rooms[":id"].items.$post({
        param: { id: roomId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useDeleteRoomItem(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await api.api.rooms[":id"].items[":itemId"].$delete({
        param: { id: roomId, itemId },
      });
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useSetItemSplits(roomId: string, itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SetRoomItemSplits) => {
      const res = await api.api.rooms[":id"].items[":itemId"].splits.$put({
        param: { id: roomId, itemId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update splits");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useFinalizeRoom(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FinalizeRoom) => {
      const res = await api.api.rooms[":id"].finalize.$post({
        param: { id: roomId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to finalize bill");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useSetPaymentMethod(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SetRoomPaymentMethod) => {
      const res = await api.api.rooms[":id"]["payment-method"].$patch({
        param: { id: roomId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to set payment method");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useClaimPayment(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      paymentId: string;
      slipData?: { transRef: string; sendingBank: string };
      slipImage?: string;
    }) => {
      const res = await api.api.rooms[":id"].payments[":paymentId"].claim.$patch({
        param: { id: roomId, paymentId: args.paymentId },
        json: {
          transRef: args.slipData?.transRef,
          sendingBank: args.slipData?.sendingBank,
          slipImage: args.slipImage,
        },
      });
      if (!res.ok) throw new Error("Failed to claim payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useConfirmPayment(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await api.api.rooms[":id"].payments[":paymentId"].confirm.$patch({
        param: { id: roomId, paymentId },
      });
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useRejectPayment(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await api.api.rooms[":id"].payments[":paymentId"].reject.$patch({
        param: { id: roomId, paymentId },
      });
      if (!res.ok) throw new Error("Failed to reject payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}
