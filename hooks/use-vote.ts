import { useToast } from "@/components/ui/use-toast";
import {
  createVote,
  deleteVote,
  updateVoteName,
} from "@/lib/api/vote/mutation";
import {
  CreateVoteSchema,
  DeleteVoteSchema,
  UpdateVoteNameSchema,
} from "@/lib/schema/vote-schema";
import { handleServerResponse } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useVote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // # MUTATIONS
  const createVoteMutation = useMutation({
    mutationFn: async (input: CreateVoteSchema) => {
      const data = await createVote(input);
      return handleServerResponse(data);
    },
    onSuccess: async (_, input) => {
      queryClient.invalidateQueries({
        queryKey: ["getPollById", input.pollId],
      });
    },
    onError: (_, input) => {
      // the poll may have changed meanwhile (slot or vote deleted)
      queryClient.invalidateQueries({
        queryKey: ["getPollById", input.pollId],
      });
      toast({
        title: "Erreur lors de la création du vote",
        description: "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    },
  });

  const updateVoteNameMutation = useMutation({
    mutationFn: async (input: UpdateVoteNameSchema) => {
      const data = await updateVoteName(input);
      return handleServerResponse(data);
    },
    onError: () => {
      toast({
        title: "Erreur lors de la modification du vote",
        description: "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    },
  });

  const deleteVoteMutation = useMutation({
    mutationFn: async (input: DeleteVoteSchema) => {
      const data = await deleteVote(input);
      return handleServerResponse(data);
    },
    onSuccess: async (_, input) => {
      queryClient.invalidateQueries({
        queryKey: ["getPollById", input.pollId],
      });
    },
    onError: (_, input) => {
      // the poll may have changed meanwhile (vote already deleted)
      queryClient.invalidateQueries({
        queryKey: ["getPollById", input.pollId],
      });
      toast({
        title: "Erreur lors de la suppression du vote",
        description: "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    },
  });

  return {
    // # MUTATIONS
    createVoteMutation,
    updateVoteNameMutation,
    deleteVoteMutation,
  };
};
