import { useToast } from "@/components/ui/use-toast";
import { createComment } from "@/lib/api/comment/mutations";
import { CreateCommentSchema } from "@/lib/schema/comment-schema";
import { useMutation } from "@tanstack/react-query";

export const useComment = () => {
  const { toast } = useToast();

  // # MUTATIONS
  const createCommentMutation = useMutation({
    mutationFn: async (input: CreateCommentSchema) => {
      const data = await createComment(input);
      return data?.data;
    },
    onSuccess: async () => {},
    onError: () => {
      toast({
        title: "Erreur lors de la création du commentaire",
        description: "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    },
  });

  return {
    // # MUTATIONS
    createCommentMutation,
  };
};
