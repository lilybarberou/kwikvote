import { Fragment, useState } from 'react';
import { getDate, timeTwoDigit, sameDay, getFormattedTimeBeforeAllowed, cn } from '@/lib/utils';
import { useVotesStore } from '@/lib/votesStore';
import { PollSlot } from '@/app/api/poll/id/[value]/route';
import { Dialog, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DialogVote from './DialogVote';
import RegistrationPollHelp from './RegistrationPollHelp';
import { Poll } from '@prisma/client';
import { useNotificationsStore } from '@/lib/notificationsStore';
import { Edit, XIcon } from 'lucide-react';
import { useAlertStore } from '@/lib/alertStore';

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
  const { votes } = useVotesStore();
  const { subscription } = useNotificationsStore();
  const [currentVoteId, setCurrentVoteId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { alerts, updateAlert } = useAlertStore();

  const TBA = getFormattedTimeBeforeAllowed({ timeBeforeAllowedType: props.poll.timeBeforeAllowedType, msBeforeAllowed: props.poll.msBeforeAllowed });

  type SlotArrayKey = 'registered' | 'waitingList' | 'waitingListReregistered' | 'notComing';
  const slotArraysLabel: { key: SlotArrayKey; label: string; detail?: string }[] = [
    { key: 'registered', label: 'Inscrits' },
    { key: 'waitingList', label: "Liste d'attente" },
    { key: 'waitingListReregistered', label: `Liste d'attente réinscrits`, detail: `(inscrit à partir de ${TBA})` },
    { key: 'notComing', label: 'Ne viennent pas' },
  ];

  const closeDialog = () => setDialogOpen(false);

  let votesBySlotId: VotesBySlotId = {};
  slots.forEach((slot) => {
    votesBySlotId[slot.id] = { 1: [], 2: [] };
    Object.values(votes).forEach((vote) => {
      const voteBySlotId = vote.choices.find((choice) => choice.slotId === slot.id);
      if (voteBySlotId) {
        votesBySlotId[slot.id][voteBySlotId.choice].push({ voteId: vote.id, name: vote.name });
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
        <Button className="mt-7 mb-2" onClick={() => setCurrentVoteId('')}>
          Nouvelle inscription
        </Button>
      </DialogTrigger>

      {/* INFO */}
      {!alerts.pollLegend && (
        <div className="bg-gray-600/20 w-fit rounded-md flex p-2 gap-3 mt-2">
          <div className="my-2 gap-2 grid grid-cols-[30px,1fr] items-center gap-x-2">
            {!!subscription && (
              <>
                <div className="w-[30px] h-[15px] rounded-sm bg-primary/40" />
                <p className="text-xs text-gray-400">Votes pour lesquels vous recevez les notifications</p>
              </>
            )}
            <Edit className="w-3 h-3  mx-auto stroke-gray-400" />
            <p className="text-xs text-gray-400">Pour modifier un vote, cliquez sur celui-ci</p>
          </div>
          <Button onClick={() => updateAlert('pollLegend', true)} variant="ghost" className="p-1 h-fit">
            <XIcon className="w-3 h-3 mx-auto stroke-gray-400" />
          </Button>
        </div>
      )}

      {/* TABLE */}
      <Table>
        <TableHeader>
          <TableRow className="!border-0 hover:bg-transparent">
            <TableHead className="pl-2 w-[330px] min-w-[140px]">
              <RegistrationPollHelp />
            </TableHead>
            {slots.map((slot) => (
              <TableHead key={slot.id} className="py-4 min-w-[140px]">
                <div className="text-center whitespace-nowrap">
                  {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                    <>
                      <p className="capitalize">{getDate(slot.startDate)}</p>
                      <p>
                        {timeTwoDigit(slot.startDate)} - {timeTwoDigit(slot.endDate)}
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
          {slotArraysLabel.map((array, index) => (
            <Fragment key={array.key}>
              <TableRow className={`mt-4 bg-[#101929] border-0 border-transparent ${index !== 0 ? 'border-t-8' : ''}`} key={array.key}>
                <TableCell className="py-2 font-bold rounded-tl-lg rounded-bl-lg whitespace-pre-wrap">
                  <p>{array.label}</p>
                  <span className="text-xs text-gray-400">{array.detail}</span>
                </TableCell>
                {slots.map((slot, index) => (
                  <TableCell
                    className={`text-center ${
                      array.key === 'registered' && slot.registered.length == slot.maxParticipants ? 'text-red-500' : 'text-muted-foreground'
                    } ${index === slots.length - 1 ? 'rounded-tr-lg rounded-br-lg' : ''}`}
                    key={slot.id}
                  >
                    {array.key === 'registered' && `${slot.registered.length}/${slot.maxParticipants}`}
                    {array.key !== 'registered' && slot[array.key].length}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="table-cell border-0 hover:bg-transparent" />
              {slots.map((slot) => (
                <TableRow className="table-cell border-0 hover:bg-transparent text-center align-top" key={slot.id}>
                  {slot[array.key].map((voteId) => {
                    const vote = votes[voteId];
                    const isAuthorOfVote = vote?.subscriptions?.some((sub) => sub.endpoint === subscription?.endpoint);

                    return (
                      <DialogTrigger key={voteId} asChild>
                        <TableCell className="py-1 px-1 block bg-background" onClick={() => setCurrentVoteId(voteId)}>
                          <Button className={cn('p-2 w-full', isAuthorOfVote && 'bg-primary/40 hover:bg-primary/30')} variant="ghost">
                            <p className="max-w-[200px] truncate">{vote?.name}</p>
                          </Button>
                        </TableCell>
                      </DialogTrigger>
                    );
                  })}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </Dialog>
  );
}
