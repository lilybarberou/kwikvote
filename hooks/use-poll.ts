import { useToast } from "@/components/ui/use-toast";
import { createPoll, deletePoll } from "@/lib/api/poll/mutation";
import { useHistoryStore } from "@/lib/historyStore";
import { CreatePollSchema } from "@/lib/schema/poll-schema";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const usePoll = () => {
  const router = useRouter();
  const { removePollFromHistory } = useHistoryStore();
  const { toast } = useToast();

  // # MUTATIONS
  const createPollMutation = useMutation({
    mutationFn: async (input: CreatePollSchema) => {
      const data = await createPoll(input);
      return data?.data;
    },
    onSuccess: async (pollId) => {
      router.push(`/poll/${pollId}?created=true`);
    },
    onError: () => {
      toast({
        title: "Erreur lors de la création du sondage",
        description: "Veuillez réessayer plus tard",
      });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const data = await deletePoll({ pollId });
      return data?.data;
    },
    onSuccess: async (_, pollId) => {
      removePollFromHistory(pollId);
      router.push(`/`);
    },
    onError: () => {
      toast({
        title: "Erreur lors de la suppression du sondage",
        description: "Veuillez réessayer plus tard",
      });
    },
  });

  return {
    // # MUTATIONS
    createPollMutation,
    deletePollMutation,
  };
};
