import { useNotificationsStore } from "@/lib/store/notificationsStore";
import {
  canHashSubscriptionEndpoint,
  hashSubscriptionEndpoint,
} from "@/lib/subscription-hash";
import { useQuery } from "@tanstack/react-query";

// the hash of the push endpoint of this browser in this poll, to find its
// votes among those of the poll (vote.subscriptionHashes); undefined without
// push subscription
export const useSubscriptionHash = (pollId: string) => {
  const endpoint = useNotificationsStore(
    (state) => state.subscription?.endpoint,
  );

  const { data } = useQuery({
    // the endpoint stays in this browser: the key is only a local cache key
    queryKey: ["subscriptionHash", pollId, endpoint],
    queryFn: () => hashSubscriptionEndpoint(pollId, endpoint!),
    enabled: !!pollId && !!endpoint && canHashSubscriptionEndpoint(),
    staleTime: Infinity,
    retry: false,
  });

  return endpoint ? data : undefined;
};
