import { useToast } from "@/components/ui/use-toast";
import { createPoll, deletePoll, updatePoll } from "@/lib/api/poll/mutation";
import {
  getPollById,
  getPolls,
  getPollsByEmail,
  isPollPasswordValid,
} from "@/lib/api/poll/query";
import { CreatePollSchema, UpdatePollSchema } from "@/lib/schema/poll-schema";
import { useCommentsStore } from "@/lib/store/commentsStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useVotesStore } from "@/lib/store/votesStore";
import { handleServerResponse } from "@/lib/utils";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";

type Props = {
  enabled?: {
    getPollById?: boolean;
    getPolls?: boolean;
    getPollsByEmail?: boolean;
  };
} | null;

const LIMIT = 12;

export const usePoll = (
  props: Props = { enabled: { getPollById: false, getPolls: false } },
) => {
  const [{ password, q: query, email }] = useQueryStates({
    password: parseAsString.withDefault(""),
    q: parseAsString.withDefault(""),
    email: parseAsString.withDefault(""),
  });

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

  const getPollsByEmailKey = ["getPollsByEmail", email.toLowerCase()];
  const getPollsByEmailQuery = useQuery({
    queryKey: getPollsByEmailKey,
    queryFn: async () => {
      const res = await getPollsByEmail(email.toLowerCase()!);
      return res?.data;
    },
    enabled: enabled?.getPollsByEmail,
  });

  const getPollsKey = ["getPolls", query];
  const getPollsQuery = useInfiniteQuery({
    queryKey: getPollsKey,
    queryFn: async ({ pageParam }) => {
      const data = await getPolls({
        password,
        query,
        limit: LIMIT,
        offset: pageParam * LIMIT,
      });
      return handleServerResponse(data);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || (lastPage && lastPage?.length < LIMIT)) return undefined;
      return pages.length;
    },
    enabled: enabled?.getPolls && !!password,
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
    mutationFn: async (input: { pollId: string; password: string }) => {
      const data = await deletePoll(input);
      return data?.data;
    },
    onSuccess: async (_, input) => {
      removePollFromHistory(input.pollId);
    },
    onError: () => {
      toast({
        title: "Erreur lors de la suppression du sondage",
        description: "Veuillez réessayer plus tard",
      });
    },
  });

  const updatePollMutation = useMutation({
    mutationFn: async (input: UpdatePollSchema) => {
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

  const checkPollPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const data = await isPollPasswordValid({ pollId, password });
      return data?.data;
    },
  });

  return {
    // # QUERIES
    getPollByIdQuery,
    getPollsQuery,
    getPollsByEmailQuery,
    // # MUTATIONS
    createPollMutation,
    deletePollMutation,
    updatePollMutation,
    checkPollPasswordMutation,
    // # COMPUTED
    keys: { getPollsKey, getPollByIdKey },
  };
};
