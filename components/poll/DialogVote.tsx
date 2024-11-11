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
import { useVote } from "@/hooks/use-vote";
import { useLocalVotesStore } from "@/lib/store/localVotesStore";
import { useNotificationsStore } from "@/lib/store/notificationsStore";
import { useVotesStore } from "@/lib/store/votesStore";
import { getDate, timeTwoDigit } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMediaQuery } from "usehooks-ts";
import { v4 } from "uuid";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const DialogVote = () => {
  const queryClient = useQueryClient();
  const { id: pollId } = useParams() as { id: string };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<{ name: string; [key: string]: string }>();

  const [voteId, setVoteId] = useQueryState(
    "vote",
    parseAsString.withDefault(""),
  );

  const currentVoteId = useRef<string | null>(null);
  if (!!voteId && currentVoteId.current !== voteId) {
    currentVoteId.current = voteId;
    reset();
  }
  const isNewVote = currentVoteId.current === "new";
  const closeDialog = () => {
    setVoteId(null);
  };

  const { createVoteMutation, deleteVoteMutation, updateVoteNameMutation } =
    useVote();
  const {
    keys: { getPollByIdKey },
    computed: { isFreePoll, isRegistrationPoll },
    getPollByIdQuery: { data: poll },
  } = usePoll({});
  const slots = poll?.slots || [];
  const pollType = poll?.type || 1;

  const { removeVote: deleteVote, addVote, votes } = useVotesStore();
  const currentVoteData = currentVoteId.current
    ? votes[currentVoteId.current]
    : null;

  const { subscription } = useNotificationsStore();
  const { addLocalVote, removeLocalVote } = useLocalVotesStore();

  const isMobile = useMediaQuery("(max-width: 700px)");

  const submitVote = handleSubmit(async (data) => {
    const areSameChoices = currentVoteData?.choices.every(
      (choice) => choice.choice === parseInt(data[`choice-${choice.slotId}`]),
    );
    const isSameName = currentVoteData?.name === data.name;

    // CASE UPDATE
    // check if choices have been modified
    if (!isNewVote && areSameChoices) {
      // check if name has been modified
      if (isSameName) {
        // do not submit if nothing has changed
        closeDialog();
        return;
      }

      // submit name only
      updateVoteNameMutation.mutate(
        {
          voteId,
          name: data.name,
          subscription: subscription || undefined,
        },
        {
          onSuccess: () => {
            addVote({
              ...currentVoteData!,
              name: data.name,
              subscriptions: subscription ? [subscription] : [],
            });
            addLocalVote(pollId, voteId);
            closeDialog();
            reset();
          },
        },
      );

      return;
    }

    // CASE CREATE
    const mutationData = {
      pollId,
      pollType,
      id: isNewVote ? v4() : voteId,
      name: data.name,
      choices: slots.map((slot) => {
        const choiceId = currentVoteData?.choices.find(
          (choice) => choice.slotId === slot.id,
        )?.id;
        return {
          id: choiceId || v4(),
          slotId: slot.id,
          choice: parseInt(data[`choice-${slot.id}`]),
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
          subscriptions: subscription ? [subscription] : [],
        });
        addLocalVote(pollId, mutationData.id);
        closeDialog();
        reset();
      },
    });
  });

  const removeVote = async () => {
    deleteVoteMutation.mutate(
      { pollId, pollType, voteId },
      {
        onSuccess: () => {
          deleteVote(voteId);
          removeLocalVote(pollId, voteId);

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
      text = isNewVote ? "Ajouter un vote" : "Modifier un vote";
    } else if (isRegistrationPoll) {
      text = isNewVote ? "Ajouter une inscription" : "Modifier une inscription";
    }

    return <DialogTitle>{text}</DialogTitle>;
  };

  return (
    <Dialog open={!!voteId}>
      <DialogContent
        onInteractOutside={() => {
          if (!isMobile) closeDialog();
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
            autoFocus={isNewVote}
            className="mb-4 mt-2"
            id="name"
            placeholder="John Doe"
            defaultValue={currentVoteData?.name}
            {...register("name", { required: true })}
          />
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
                      currentVoteData?.choices
                        .find((choice) => choice.slotId === slot.id)
                        ?.choice.toString() ?? ""
                    }
                    render={({ field }) => (
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger
                          autoFocus={isNewVote ? false : index == 0}
                          className="min-w-[180px]"
                        >
                          <SelectValue placeholder="À définir" />
                        </SelectTrigger>
                        <SelectContent
                          ref={(ref) => {
                            if (!ref) return;
                            ref.ontouchstart = (e) => e.preventDefault();
                          }}
                        >
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
                    <p className="ml-auto text-sm text-destructive">
                      Champ requis
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4 flex-row">
            {!isNewVote && (
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      className="mr-auto"
                      onClick={removeVote}
                      type="button"
                      size="icon"
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Supprimer le vote</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={closeDialog} variant="outline">
                Annuler
              </Button>
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
    </Dialog>
  );
};
