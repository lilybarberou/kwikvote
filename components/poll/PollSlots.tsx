"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GetPollById } from "@/lib/api/poll/query";
import { useVotesStore } from "@/lib/store/votesStore";
import { getDate, sameDay, timeTwoDigit } from "@/lib/utils";
import {
  CheckCircle,
  CircleUserRound,
  Edit,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { DialogVote } from "./DialogVote";

type Props = {
  slots: NonNullable<GetPollById>["slots"];
};

export const PollSlots = (props: Props) => {
  const { votes } = useVotesStore();
  const [currentVoteId, setCurrentVoteId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const TotalUpvotes = ({ slotId }: { slotId: string }) => {
    const total = Object.values(votes).reduce(
      (acc, vote) => {
        const choice = vote.choices.find((choice) => choice.slotId === slotId);
        if (choice?.choice === 1) acc[0]++;
        else if (choice?.choice === 3) acc[1]++;
        return acc;
      },
      [0, 0],
    );

    return (
      <TableCell className="text-center">
        {/* light theme: -700 shades, the -400 ones gave 1.8:1 on white */}
        <div className="flex items-center justify-center gap-1 text-green-700 dark:text-green-400">
          {total[0]}
          <VoteIcon choice={1} />
          {total[1] > 0 && (
            <span className="ml-2 flex items-center gap-1 text-yellow-700 dark:text-yellow-200">
              {total[1]} <VoteIcon choice={3} />
            </span>
          )}
        </div>
      </TableCell>
    );
  };

  const VoteIcon = ({ choice }: { choice: number }) => {
    switch (choice) {
      // role img + label: the icons are the only content of the cells
      case 1:
        return (
          <CheckCircle
            role="img"
            aria-label="Oui"
            className="inline-block h-4 w-4 text-green-600 dark:text-green-400"
          />
        );
      case 2:
        return (
          <XCircle
            role="img"
            aria-label="Non"
            className="inline-block h-4 w-4 text-red-600 dark:text-red-400"
          />
        );
      case 3:
        return (
          <HelpCircle
            role="img"
            aria-label="Ne sais pas"
            className="inline-block h-4 w-4 text-yellow-700 dark:text-yellow-200"
          />
        );
    }
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogVote
        pollType={1}
        currentVoteId={currentVoteId}
        slots={props.slots}
        closeDialog={closeDialog}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <DialogTrigger asChild>
                <Button onClick={() => setCurrentVoteId("")}>
                  Nouveau vote
                </Button>
              </DialogTrigger>
            </TableHead>
            {props.slots.map((slot) => (
              <TableHead key={slot.id} className="py-4">
                {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                  <div className="whitespace-nowrap text-center">
                    <p className="capitalize">{getDate(slot.startDate)}</p>
                    <p>
                      {timeTwoDigit(slot.startDate)} -{" "}
                      {timeTwoDigit(slot.endDate)}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="capitalize">{getDate(slot.startDate)}</p>
                    <p>{timeTwoDigit(slot.startDate)}</p>
                    <p className="capitalize">{getDate(slot.endDate)}</p>
                    <p>{timeTwoDigit(slot.endDate)}</p>
                  </>
                )}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Modifier</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/50">
            <TableHead
              scope="row"
              className="flex h-auto justify-between p-4 font-bold text-foreground"
            >
              Total{" "}
              <span className="flex gap-1">
                {Object.keys(votes).length}{" "}
                <CircleUserRound
                  role="img"
                  aria-label="votants"
                  className="h-5 w-5"
                />
              </span>
            </TableHead>
            {props.slots.map((slot) => (
              <TotalUpvotes slotId={slot.id} key={slot.id} />
            ))}
            <TableCell />
          </TableRow>
          {Object.values(votes).map((vote) => (
            <TableRow key={vote.id}>
              <TableHead
                scope="row"
                className="h-auto max-w-[220px] overflow-hidden p-4 py-2 font-normal text-ellipsis whitespace-nowrap text-foreground"
              >
                {vote.name}
              </TableHead>
              {vote.choices.map((choice) => (
                <TableCell className="py-2 text-center" key={choice.id}>
                  <VoteIcon choice={choice.choice} />
                </TableCell>
              ))}
              <TableCell className="flex justify-center py-2">
                <DialogTrigger asChild>
                  <Button
                    onClick={() => setCurrentVoteId(vote.id)}
                    className="h-8 w-8"
                    size="icon"
                    variant="outline"
                    aria-label={`Modifier le vote de ${vote.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Dialog>
  );
};
