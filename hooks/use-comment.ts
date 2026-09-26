import { useToast } from "@/components/ui/use-toast";
import { createComment } from "@/lib/api/comment/mutations";
import { CreateCommentSchema } from "@/lib/schema/comment-schema";
import { getErrorMessage, handleServerResponse } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";

export const useComment = () => {
  const { toast } = useToast();

  // # MUTATIONS
  const createCommentMutation = useMutation({
    mutationFn: async (input: CreateCommentSchema) => {
      const data = await createComment(input);
      return handleServerResponse(data);
    },
    onSuccess: async () => {},
    onError: (error) => {
      toast({
        title: "Erreur lors de la création du commentaire",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return {
    // # MUTATIONS
    createCommentMutation,
  };
};
