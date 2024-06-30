"use client";

import { PollSlot } from "@/app/api/poll/id/[value]/route";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAlertStore } from "@/lib/alertStore";
import { useNotificationsStore } from "@/lib/notificationsStore";
import {
  cn,
  getDate,
  getFormattedTimeBeforeAllowed,
  sameDay,
  timeTwoDigit,
} from "@/lib/utils";
import { useVotesStore } from "@/lib/votesStore";
import { Poll } from "@prisma/client";
import { Edit, XIcon } from "lucide-react";
import { Fragment, useState } from "react";

import DialogVote from "./DialogVote";
import RegistrationPollHelp from "./RegistrationPollHelp";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogTrigger } from "./ui/dialog";

type Props = {
  slots: PollSlot[];
  poll: Poll;
};

type VotesBySlotId = {
  [slotId: string]: {
    [choice: number]: { voteId: string; name: string }[];
  };
};

export default function RegistrationPoll(props: Props) {
  const [slots, setSlots] = useState(props.slots);
  const [currentVoteId, setCurrentVoteId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAllNotComing, setShowAllNotComing] = useState(false);
  const { votes } = useVotesStore();
  const { subscription } = useNotificationsStore();
  const { alerts, updateAlert } = useAlertStore();

  const TBA = getFormattedTimeBeforeAllowed({
    timeBeforeAllowedType: props.poll.timeBeforeAllowedType,
    msBeforeAllowed: props.poll.msBeforeAllowed,
  });

  type SlotArrayKey =
    | "registered"
    | "waitingList"
    | "waitingListReregistered"
    | "notComing";
  const slotArraysLabel: {
    key: SlotArrayKey;
    label: string;
    detail?: string;
  }[] = [
    { key: "registered", label: "Inscrits" },
    { key: "waitingList", label: "Liste d'attente" },
    {
      key: "waitingListReregistered",
      label: `Liste d'attente réinscrits`,
      detail: `(inscrit à partir de ${TBA})`,
    },
    { key: "notComing", label: "Ne viennent pas" },
  ];

  const closeDialog = () => setDialogOpen(false);

  let votesBySlotId: VotesBySlotId = {};
  slots.forEach((slot) => {
    votesBySlotId[slot.id] = { 1: [], 2: [] };
    Object.values(votes).forEach((vote) => {
      const voteBySlotId = vote.choices.find(
        (choice) => choice.slotId === slot.id,
      );
      if (voteBySlotId) {
        votesBySlotId[slot.id][voteBySlotId.choice].push({
          voteId: vote.id,
          name: vote.name,
        });
      }
    });
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogVote
        setCurrentVoteId={setCurrentVoteId}
        setSlots={setSlots}
        pollType={2}
        currentVoteId={currentVoteId}
        slots={slots}
        closeDialog={closeDialog}
        pollId={props.poll.id}
      />
      <DialogTrigger asChild>
        <Button className="mb-2 mt-7" onClick={() => setCurrentVoteId("")}>
          Nouvelle inscription
        </Button>
      </DialogTrigger>

      {/* INFO */}
      {!alerts.pollLegend && (
        <div className="mt-2 flex w-fit gap-3 rounded-md bg-gray-600/20 p-2">
          <div className="my-2 grid grid-cols-[30px,1fr] items-center gap-2 gap-x-2">
            {!!subscription && (
              <>
                <div className="h-[15px] w-[30px] rounded-sm bg-primary/40" />
                <p className="text-xs text-gray-400">
                  Votes pour lesquels vous recevez les notifications
                </p>
              </>
            )}
            <Edit className="mx-auto h-3 w-3 stroke-gray-400" />
            <p className="text-xs text-gray-400">
              Pour modifier un vote, cliquez sur celui-ci
            </p>
          </div>
          <Button
            onClick={() => updateAlert("pollLegend", true)}
            variant="ghost"
            className="h-fit p-1"
          >
            <XIcon className="mx-auto h-3 w-3 stroke-gray-400" />
          </Button>
        </div>
      )}

      {/* TABLE */}
      <Table>
        <TableHeader>
          <TableRow className="!border-0 hover:bg-transparent">
            <TableHead className="w-[330px] min-w-[140px] pl-2">
              <RegistrationPollHelp />
            </TableHead>
            {slots.map((slot) => (
              <TableHead key={slot.id} className="min-w-[140px] py-4">
                <div className="whitespace-nowrap text-center">
                  {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                    <>
                      <p className="capitalize">{getDate(slot.startDate)}</p>
                      <p>
                        {timeTwoDigit(slot.startDate)} -{" "}
                        {timeTwoDigit(slot.endDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="capitalize">{getDate(slot.startDate)}</p>
                      <p>{timeTwoDigit(slot.startDate)}</p>
                      <p className="capitalize">{getDate(slot.endDate)}</p>
                      <p>{timeTwoDigit(slot.endDate)}</p>
                    </>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {slotArraysLabel.map((array, index) => {
            const isNotComingColumn = array.key === "notComing";

            return (
              <Fragment key={array.key}>
                <TableRow
                  className={`mt-4 border-0 border-transparent bg-[#101929] ${index !== 0 ? "border-t-8" : ""}`}
                >
                  <TableCell className="whitespace-pre-wrap rounded-bl-lg rounded-tl-lg py-2 font-bold">
                    <p>{array.label}</p>
                    <span className="text-xs text-gray-400">
                      {array.detail}
                    </span>
                    {isNotComingColumn && (
                      <div className="mt-1 flex items-center gap-2">
                        <Checkbox
                          id="show-all-not-coming"
                          onCheckedChange={() =>
                            setShowAllNotComing((prev) => !prev)
                          }
                        />
                        <label
                          className="font-normal"
                          htmlFor="show-all-not-coming"
                        >
                          Voir tout
                        </label>
                      </div>
                    )}
                  </TableCell>
                  {slots.map((slot, index) => (
                    <TableCell
                      className={`text-center ${
                        array.key === "registered" &&
                        slot.registered.length == slot.maxParticipants
                          ? "text-red-500"
                          : "text-muted-foreground"
                      } ${index === slots.length - 1 ? "rounded-br-lg rounded-tr-lg" : ""}`}
                      key={slot.id}
                    >
                      {array.key === "registered" &&
                        `${slot.registered.length}/${slot.maxParticipants}`}
                      {array.key !== "registered" && slot[array.key].length}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="table-cell border-0 hover:bg-transparent" />
                {slots.map((slot) => (
                  <TableRow
                    className="table-cell border-0 text-center align-top hover:bg-transparent"
                    key={slot.id}
                  >
                    {slot[array.key]
                      // put author's votes first (only for notComing column)
                      .sort((voteId) => {
                        if (!isNotComingColumn) return 1;
                        return votes[voteId]?.subscriptions?.some(
                          (sub) => sub.endpoint === subscription?.endpoint,
                        )
                          ? -1
                          : 1;
                      })
                      .map((voteId) => {
                        const vote = votes[voteId];
                        const isAuthorOfVote = vote?.subscriptions?.some(
                          (sub) => sub.endpoint === subscription?.endpoint,
                        );

                        if (
                          isNotComingColumn &&
                          !isAuthorOfVote &&
                          !showAllNotComing
                        )
                          return null;
                        return (
                          <DialogTrigger key={voteId} asChild>
                            <TableCell
                              className="block bg-background px-1 py-1"
                              onClick={() => setCurrentVoteId(voteId)}
                            >
                              <Button
                                className={cn(
                                  "w-full p-2",
                                  isAuthorOfVote &&
                                    "bg-primary/40 hover:bg-primary/30",
                                )}
                                variant="ghost"
                              >
                                <p className="max-w-[200px] truncate">
                                  {vote?.name}
                                </p>
                              </Button>
                            </TableCell>
                          </DialogTrigger>
                        );
                      })}
                  </TableRow>
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Dialog>
  );
}
