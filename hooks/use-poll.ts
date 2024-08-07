import { useToast } from "@/components/ui/use-toast";
import { createPoll, deletePoll, updatePoll } from "@/lib/api/poll/mutation";
import { getPollById } from "@/lib/api/poll/query";
import { CreatePollSchema, PollSettingsSchema } from "@/lib/schema/poll-schema";
import { useCommentsStore } from "@/lib/store/commentsStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useVotesStore } from "@/lib/store/votesStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

type Props = {
  enabled?: {
    getPollById: boolean;
  };
} | null;

export const usePoll = (props: Props = { enabled: { getPollById: false } }) => {
  let enabled = {} as NonNullable<Props>["enabled"];
  if (props) enabled = props.enabled;

  const params = useParams() as { id: string };
  const pollId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { removePollFromHistory, addPollToHistory } = useHistoryStore();
  const { toast } = useToast();
  const { initComments } = useCommentsStore();
  const { initVotes } = useVotesStore();

  // # QUERIES
  const getPollByIdKey = ["getPollById", pollId];
  const getPollByIdQuery = useQuery({
    queryKey: getPollByIdKey,
    queryFn: async () => {
      const res = await getPollById({ pollId });
      console.log("ok");
      const data = res?.data!;

      if (data) {
        initVotes(data.votes);
        initComments(data.comments);
        addPollToHistory(pollId, data.title || "");
      } else removePollFromHistory(pollId);

      return data;
    },
    enabled: enabled?.getPollById,
  });

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

  const updatePollMutation = useMutation({
    mutationFn: async (input: PollSettingsSchema) => {
      const data = await updatePoll({ pollId: pollId, ...input });
      return data?.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: getPollByIdKey });

      toast({
        title: "Sondage mis à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur lors de la modification du sondage",
        description: "Veuillez réessayer plus tard",
      });
    },
  });

  return {
    // # QUERIES
    getPollByIdQuery,
    // # MUTATIONS
    createPollMutation,
    deletePollMutation,
    updatePollMutation,
  };
};
