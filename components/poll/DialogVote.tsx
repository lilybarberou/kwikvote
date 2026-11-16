"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePoll } from "@/hooks/use-poll";
import { useSubscriptionHash } from "@/hooks/use-subscription-hash";
import { useVote } from "@/hooks/use-vote";
import { VOTE_NAME_MAX_LENGTH } from "@/lib/schema/limits";
import { useLocalVotesStore } from "@/lib/store/localVotesStore";
import { useNotificationsStore } from "@/lib/store/notificationsStore";
import { useVotesStore } from "@/lib/store/votesStore";
import { getDate, timeTwoDigit } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { SetStateAction, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMediaQuery } from "usehooks-ts";
import { v4 } from "uuid";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Props = {
  slots: { id: string; startDate: Date; endDate: Date }[];
  pollType: number;
  currentVoteId: string;
  closeDialog: () => void;
  setCurrentVoteId: React.Dispatch<SetStateAction<string>>;
};

export const DialogVote = (props: Props) => {
  const { id: pollId } = useParams() as { id: string };

  const {
    keys: { getPollByIdKey },
  } = usePoll({});
  const queryClient = useQueryClient();
  const params = useParams() as { id: string };
  const { createVoteMutation, deleteVoteMutation, updateVoteNameMutation } =
    useVote();
  const { currentVoteId, slots, closeDialog, setCurrentVoteId, pollType } =
    props;
  const { removeVote: deleteVote, addVote, votes } = useVotesStore();
  const { subscription } = useNotificationsStore();
  const subscriptionHash = useSubscriptionHash(pollId);
  const { addLocalVote, removeLocalVote } = useLocalVotesStore();
  // choice-{slotId}: "1" | "2" | "3", priority-{slotId}: boolean
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<{ name: string; [key: string]: string | boolean }>();

  const isMobile = useMediaQuery("(max-width: 700px)");
  const isFreePoll = pollType == 1;
  const isRegistrationPoll = pollType == 2;

  useEffect(() => {
    reset();
  }, [currentVoteId, reset]);

  const getStoredChoice = (slotId: string) =>
    votes[currentVoteId]?.choices.find((choice) => choice.slotId === slotId);

  const submitVote = handleSubmit(async (data) => {
    const getChoice = (slotId: string) =>
      parseInt(String(data[`choice-${slotId}`]));
    // a priority only makes sense on a yes of a registration poll,
    // a checkbox never displayed keeps the stored priority
    const getPriority = (slotId: string) => {
      const priority = data[`priority-${slotId}`];
      return (
        isRegistrationPoll &&
        getChoice(slotId) === 1 &&
        (priority === undefined
          ? !!getStoredChoice(slotId)?.priority
          : priority === true)
      );
    };

    const areSameChoices = votes[currentVoteId]?.choices.every(
      (choice) =>
        choice.choice === getChoice(choice.slotId) &&
        !!choice.priority === getPriority(choice.slotId),
    );
    const isSameName = votes[currentVoteId]?.name === data.name;

    // CASE UPDATE
    // check if choices have been modified
    if (currentVoteId && areSameChoices) {
      // check if name has been modified
      if (isSameName) {
        // do not submit  if nothing has changed
        closeDialog();
        return;
      }

      // submit name only
      updateVoteNameMutation.mutate(
        {
          voteId: currentVoteId,
          name: data.name,
          subscription: subscription || undefined,
        },
        {
          onSuccess: () => {
            addVote({
              ...votes[currentVoteId],
              name: data.name,
              subscriptionHashes: subscriptionHash ? [subscriptionHash] : [],
            });
            addLocalVote(pollId, currentVoteId);
            closeDialog();
            reset();
            setCurrentVoteId("edited"); // TODO FAIRE MIEUX
          },
        },
      );

      return;
    }

    // CASE CREATE
    const mutationData = {
      pollId,
      id: currentVoteId || v4(),
      name: data.name,
      choices: slots.map((slot) => {
        const choiceId = votes[currentVoteId]?.choices.find(
          (choice) => choice.slotId === slot.id,
        )?.id;
        return {
          id: choiceId || v4(),
          slotId: slot.id,
          choice: getChoice(slot.id),
          priority: getPriority(slot.id),
        };
      }),
      subscription: subscription || undefined,
    };

    createVoteMutation.mutate(mutationData, {
      onSuccess: async () => {
        if (isRegistrationPoll) {
          // update local slots with new sorts
          queryClient.invalidateQueries({
            queryKey: getPollByIdKey,
          });
        }
        addVote({
          ...mutationData,
          subscriptionHashes: subscriptionHash ? [subscriptionHash] : [],
        });
        addLocalVote(pollId, mutationData.id);
        closeDialog();
        reset();
        setCurrentVoteId("edited"); // TODO FAIRE MIEUX
      },
    });
  });

  const removeVote = async () => {
    deleteVoteMutation.mutate(
      { pollId, voteId: currentVoteId },
      {
        onSuccess: () => {
          deleteVote(currentVoteId);
          removeLocalVote(pollId, currentVoteId);

          if (isRegistrationPoll) {
            queryClient.invalidateQueries({
              queryKey: getPollByIdKey,
            });
          }

          closeDialog();
        },
      },
    );
  };

  const DialogTitleBySlotType = () => {
    let text = "";
    if (isFreePoll) {
      text = currentVoteId ? "Modifier un vote" : "Ajouter un vote";
    } else if (isRegistrationPoll) {
      text = currentVoteId
        ? "Modifier une inscription"
        : "Ajouter une inscription";
    }

    return <DialogTitle>{text}</DialogTitle>;
  };

  return (
    <DialogContent
      onInteractOutside={(e) => {
        if (isMobile) e.preventDefault();
      }}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="w-11/12 max-w-[400px]"
    >
      <DialogTitleBySlotType />
      <form onSubmit={submitVote}>
        <Label className="mt-4" htmlFor="name">
          Nom
        </Label>
        <Input
          autoFocus={!Boolean(currentVoteId)}
          className={errors.name ? "mt-2" : "mb-4 mt-2"}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "error-name" : undefined}
          id="name"
          defaultValue={votes[currentVoteId]?.name ?? ""}
          placeholder="John Doe"
          maxLength={VOTE_NAME_MAX_LENGTH}
          {...register("name", { required: true })}
        />
        {errors.name && (
          <p
            id="error-name"
            className="mb-4 mt-1 text-sm text-destructive dark:text-red-400"
          >
            Champ requis
          </p>
        )}
        {isRegistrationPoll && (
          <p id="priority-help" className="text-sm text-muted-foreground">
            Avant l'ouverture des réinscriptions, vous n'êtes inscrit que sur un
            créneau : le premier qui a de la place. Cochez{" "}
            <span className="whitespace-nowrap">« Prioritaire »</span> sur vos
            créneaux préférés pour qu'ils passent en premier.
          </p>
        )}
        <div>
          {slots.map((slot, index) => (
            <div
              key={slot.id}
              className={`flex flex-wrap items-center gap-x-14 gap-y-3 py-4 sm:grid sm:grid-cols-[max-content_auto] sm:py-2 ${
                slots.length - 1 === index ? "" : "border-b-2"
              }`}
            >
              <div className="flex flex-wrap items-end gap-x-2 sm:flex-col sm:items-start">
                <p>{getDate(slot.startDate)}</p>
                <p className="text-sm text-muted-foreground">
                  {timeTwoDigit(slot.startDate)}
                </p>
              </div>
              <div className="flex-1">
                <Controller
                  control={control}
                  rules={{ required: true }}
                  name={`choice-${slot.id}`}
                  defaultValue={
                    getStoredChoice(slot.id)?.choice.toString() ?? ""
                  }
                  render={({ field }) => (
                    <Select
                      {...field}
                      // choice fields only hold strings
                      value={field.value as string}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        autoFocus={currentVoteId ? index == 0 : false}
                        aria-label={`Choix – ${getDate(slot.startDate)} ${timeTwoDigit(slot.startDate)}`}
                        aria-invalid={!!errors[`choice-${slot.id}`]}
                        aria-describedby={
                          errors[`choice-${slot.id}`]
                            ? `error-choice-${slot.id}`
                            : undefined
                        }
                        className="min-w-[180px]"
                      >
                        <SelectValue placeholder="À définir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Oui</SelectItem>
                        <SelectItem value="2">Non</SelectItem>
                        {isFreePoll && (
                          <SelectItem value="3">Ne sais pas</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors[`choice-${slot.id}`] && (
                  <p
                    id={`error-choice-${slot.id}`}
                    className="ml-auto text-sm text-destructive dark:text-red-400"
                  >
                    Champ requis
                  </p>
                )}
                {isRegistrationPoll &&
                  // the stored choice until the field is registered
                  watch(
                    `choice-${slot.id}`,
                    getStoredChoice(slot.id)?.choice.toString(),
                  ) === "1" && (
                    <Controller
                      control={control}
                      name={`priority-${slot.id}`}
                      defaultValue={getStoredChoice(slot.id)?.priority ?? false}
                      render={({ field }) => (
                        <div className="mt-2 flex items-center gap-2">
                          <Checkbox
                            id={`priority-${slot.id}`}
                            aria-label={`Prioritaire – ${getDate(slot.startDate)} ${timeTwoDigit(slot.startDate)}`}
                            aria-describedby="priority-help"
                            checked={field.value === true}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                          <Label
                            htmlFor={`priority-${slot.id}`}
                            className="flex cursor-pointer items-center gap-1 font-normal"
                          >
                            <Star
                              aria-hidden
                              className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500"
                            />
                            Prioritaire
                          </Label>
                        </div>
                      )}
                    />
                  )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4 flex-row">
          {currentVoteId && (
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    className="mr-auto"
                    onClick={removeVote}
                    type="button"
                    size="icon"
                    variant="destructive"
                    aria-label="Supprimer le vote"
                    disabled={deleteVoteMutation.isPending}
                  >
                    {deleteVoteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Supprimer le vote</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={createVoteMutation.isPending}>
              Confirmer
              {createVoteMutation.isPending && (
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
