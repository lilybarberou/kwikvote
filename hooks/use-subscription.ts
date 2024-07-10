import { useToast } from "@/components/ui/use-toast";
import { createSubscription } from "@/lib/api/subscription/mutation";
import { useNotificationsStore } from "@/lib/notificationsStore";
import { CreateSubscriptionSchema } from "@/lib/schema/subscription-schema";
import { useMutation } from "@tanstack/react-query";

export const useSubscription = () => {
  const { toast } = useToast();
  const { init } = useNotificationsStore();

  // # MUTATIONS
  const createSubscriptionMutation = useMutation({
    mutationFn: async (input: CreateSubscriptionSchema) => {
      const data = await createSubscription(input);
      return data?.data;
    },
    onSuccess: async (_, input) => {
      init({
        notificationsSupported: true,
        notificationsPermission: "granted",
        subscription: {
          endpoint: input.endpoint!,
          auth: input.keys.auth,
          p256dh: input.keys.p256dh,
        },
      });
      toast({
        title: "Notifications activées",
        description: `Il ne vous reste plus qu'à vous inscrire au sondage !`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description:
          "Une erreur est survenue lors de l'activation des notifications.",
      });
    },
  });

  return {
    // # MUTATIONS
    createSubscriptionMutation,
  };
};
