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
import { getErrorMessage, handleServerResponse } from "@/lib/utils";
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
  const [{ q: query, email }] = useQueryStates({
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

      // only a poll that doesn't exist (any more) leaves the history
      if (res?.data === null) {
        removePollFromHistory(pollId);
        return null;
      }
      // any other failure (network, server error) throws: the query is in
      // error and retried, the poll stays in the history. Not null here: null
      // was handled above, handleServerResponse throws without data
      const data = handleServerResponse(res)!;

      initVotes(data.votes);
      initComments(data.comments);
      addPollToHistory(pollId, data.title || "");
      return data;
    },
    enabled: enabled?.getPollById,
  });

  const getPollsByEmailKey = ["getPollsByEmail", email.toLowerCase()];
  const getPollsByEmailQuery = useQuery({
    queryKey: getPollsByEmailKey,
    queryFn: async () => {
      // an error (too many searches) is shown, not taken for "no poll"
      const res = await getPollsByEmail(email.toLowerCase()!);
      return handleServerResponse(res);
    },
    retry: false,
    enabled: !!enabled?.getPollsByEmail,
  });

  const getPollsKey = ["getPolls", query];
  const getPollsQuery = useInfiniteQuery({
    queryKey: getPollsKey,
    queryFn: async ({ pageParam }) => {
      // the admin session cookie authorizes it
      const data = await getPolls({
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
    enabled: !!enabled?.getPolls,
  });

  // # MUTATIONS
  const createPollMutation = useMutation({
    mutationFn: async (input: CreatePollSchema) => {
      const data = await createPoll(input);
      return handleServerResponse(data);
    },
    onSuccess: async (pollId) => {
      router.push(`/poll/${pollId}?created=true`);
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la création du sondage",
        description: getErrorMessage(error),
      });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (input: { pollId: string; password: string }) => {
      const data = await deletePoll(input);
      return handleServerResponse(data);
    },
    onSuccess: async (_, input) => {
      removePollFromHistory(input.pollId);
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la suppression du sondage",
        description: getErrorMessage(error),
      });
    },
  });

  const updatePollMutation = useMutation({
    mutationFn: async (input: UpdatePollSchema) => {
      const data = await updatePoll({ pollId: pollId, ...input });
      return handleServerResponse(data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: getPollByIdKey });

      toast({
        title: "Sondage mis à jour",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la modification du sondage",
        description: getErrorMessage(error),
      });
    },
  });

  // an invalid password is a server error: no data, handled as false; the
  // other errors (too many attempts) are thrown, with their message
  const checkPollPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const data = await isPollPasswordValid({ pollId, password });
      if (data?.serverError && data.serverError !== "Mot de passe incorrect")
        throw new Error(data.serverError);
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
