import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDate, sameDay, timeTwoDigit } from "@/lib/utils";
import { useVotesStore } from "@/lib/votesStore";
import {
  CheckCircle,
  CircleUserRound,
  Edit,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import DialogVote from "./DialogVote";
import { Button } from "./ui/button";
import { Dialog, DialogTrigger } from "./ui/dialog";

type Props = {
  slots: { id: string; startDate: Date; endDate: Date }[];
  pollId: string;
};

export default function PollSlot(props: Props) {
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
        <div className="flex items-center justify-center gap-1 text-green-400">
          {total[0]}
          <VoteIcon choice={1} />
          {total[1] > 0 && (
            <span className="ml-2 flex items-center gap-1 text-yellow-200">
              {total[1]} <VoteIcon choice={3} />
            </span>
          )}
        </div>
      </TableCell>
    );
  };

  const VoteIcon = ({ choice }: { choice: number }) => {
    switch (choice) {
      case 1:
        return <CheckCircle className="inline-block h-4 w-4 text-green-400" />;
      case 2:
        return <XCircle className="inline-block h-4 w-4 text-red-400" />;
      case 3:
        return <HelpCircle className="inline-block h-4 w-4 text-yellow-200" />;
    }
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogVote
        pollType={1}
        setCurrentVoteId={setCurrentVoteId}
        currentVoteId={currentVoteId}
        slots={props.slots}
        closeDialog={closeDialog}
        pollId={props.pollId}
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
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="flex justify-between font-bold">
              Total{" "}
              <span className="flex gap-1">
                {Object.keys(votes).length}{" "}
                <CircleUserRound className="h-5 w-5" />
              </span>
            </TableCell>
            {props.slots.map((slot) => (
              <TotalUpvotes slotId={slot.id} key={slot.id} />
            ))}
            <TableCell />
          </TableRow>
          {Object.values(votes).map((vote) => (
            <TableRow key={vote.id}>
              <TableCell className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap py-2">
                {vote.name}
              </TableCell>
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
}
