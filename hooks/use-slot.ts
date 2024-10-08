import { deleteSlotById } from "@/lib/api/slot/mutation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export const useSlot = () => {
  const queryClient = useQueryClient();
  const params = useParams() as { id: string };
  const pollId = params.id;

  // # MUTATIONS
  const deleteSlotByIdMutation = useMutation({
    mutationFn: async (input: { slotId: string; password: string }) => {
      const data = await deleteSlotById({ ...input, pollId });
      return data?.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["getPollById", pollId] });
    },
  });

  return {
    // # MUTATIONS
    deleteSlotByIdMutation,
  };
};
