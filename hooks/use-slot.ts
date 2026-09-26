import { useToast } from "@/components/ui/use-toast";
import { deleteSlotById, updateSlotById } from "@/lib/api/slot/mutation";
import { UpdateSlotSchema } from "@/lib/schema/slot-schema";
import { getErrorMessage, handleServerResponse } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export const useSlot = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useParams() as { id: string };
  const pollId = params.id;
  // not from usePoll({}), which would enable all its queries for each slot
  const getPollByIdKey = ["getPollById", pollId];

  // # MUTATIONS
  const deleteSlotByIdMutation = useMutation({
    mutationFn: async (input: { slotId: string; password: string }) => {
      const data = await deleteSlotById({ ...input, pollId });
      return handleServerResponse(data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: getPollByIdKey });
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la suppression du créneau",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const updateSlotByIdMutation = useMutation({
    mutationFn: async (input: UpdateSlotSchema & { password: string }) => {
      const data = await updateSlotById({ ...input, pollId });
      return handleServerResponse(data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: getPollByIdKey });

      toast({
        title: "Créneau mis à jour",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la modification du créneau",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return {
    // # MUTATIONS
    deleteSlotByIdMutation,
    updateSlotByIdMutation,
  };
};
