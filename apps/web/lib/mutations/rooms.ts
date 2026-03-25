import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  CreateRoom,
  JoinRoom,
  FinalizeRoom,
  SetRoomPaymentMethod,
  RoomStatus,
} from "@pladuk/shared/schemas";

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await api.api.rooms.invites[":id"].accept.$post({
        param: { id: inviteId },
      });
      if (!res.ok) throw new Error("Failed to accept invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "invites"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", "my"] });
    },
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await api.api.rooms.invites[":id"].decline.$post({
        param: { id: inviteId },
      });
      if (!res.ok) throw new Error("Failed to decline invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "invites"] });
    },
  });
}

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
      slipData?: { transRef: string; sendingBank: string; qrData: string };
      slipImage?: string;
    }) => {
      const res = await api.api.rooms[":id"].payments[":paymentId"].claim.$patch({
        param: { id: roomId, paymentId: args.paymentId },
        json: {
          transRef: args.slipData?.transRef,
          sendingBank: args.slipData?.sendingBank,
          qrData: args.slipData?.qrData,
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

export function useUnconfirmPayment(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await api.api.rooms[":id"].payments[":paymentId"].unconfirm.$patch({
        param: { id: roomId, paymentId },
      });
      if (!res.ok) throw new Error("Failed to unconfirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useNudgeMember(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/nudge?memberId=${memberId}`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to nudge");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useNudgeAll(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/nudge`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to nudge all");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: async (image: string) => {
      const res = await api.api.rooms["scan-receipt"].$post({
        json: { image },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error || "OCR failed");
      }
      return res.json();
    },
  });
}

export function useParseVoice() {
  return useMutation({
    mutationFn: async (transcript: string) => {
      const res = await api.api.rooms["parse-voice"].$post({
        json: { transcript },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error || "Voice parsing failed");
      }
      return res.json();
    },
  });
}
