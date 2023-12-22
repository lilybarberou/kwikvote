import { useState } from 'react';
import { getDate, getTime, sameDay } from '@/lib/utils';
import { useVotesStore } from '@/lib/votesStore';
import { PollSlot } from '@/app/api/poll/id/[value]/route';
import { Dialog, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DialogVote from './DialogVote';
import RegistrationPollHelp from './RegistrationPollHelp';

type Props = {
    slots: PollSlot[];
    pollId: string;
};

type VotesBySlotId = {
    [slotId: string]: {
        [choice: number]: { voteId: string; name: string }[];
    };
};

type SlotArrayKey = 'registered' | 'waitingList' | 'waitingListReregistered' | 'notComing';
const slotArraysLabel: { key: SlotArrayKey; label: string }[] = [
    { key: 'registered', label: 'Inscrits' },
    { key: 'waitingList', label: "Liste d'attente" },
    { key: 'waitingListReregistered', label: "Liste d'attente réinscrits" },
    { key: 'notComing', label: 'Ne viennent pas' },
];

export default function RegistrationPoll(props: Props) {
    const [slots, setSlots] = useState(props.slots);
    const { votes } = useVotesStore();
    const [currentVoteId, setCurrentVoteId] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);

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
                pollId={props.pollId}
            />
            <DialogTrigger asChild>
                <Button className="mt-7 mb-2" onClick={() => setCurrentVoteId('')}>
                    Nouvelle inscription
                </Button>
            </DialogTrigger>
            <Table>
                <TableHeader>
                    <TableRow className="!border-0 hover:bg-transparent">
                        <TableHead className="pl-2 w-[190px] min-w-[130px]">
                            <RegistrationPollHelp />
                        </TableHead>
                        {slots.map((slot) => (
                            <TableHead key={slot.id} className="py-4 min-w-[140px]">
                                <div className="text-center whitespace-nowrap">
                                    {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                                        <>
                                            <p>{getDate(slot.startDate)}</p>
                                            <p>
                                                {getTime(slot.startDate)} - {getTime(slot.endDate)}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p>{getDate(slot.startDate)}</p>
                                            <p>{getTime(slot.startDate)}</p>
                                            <p>{getDate(slot.endDate)}</p>
                                            <p>{getTime(slot.endDate)}</p>
                                        </>
                                    )}
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {slotArraysLabel.map((array, index) => (
                        <>
                            <TableRow className={`mt-4 bg-[#101929] border-0 border-transparent ${index !== 0 ? 'border-t-8' : ''}`} key={array.key}>
                                <TableCell className="py-2 font-bold rounded-tl-lg rounded-bl-lg">{array.label}</TableCell>
                                {slots.map((slot, index) => (
                                    <TableCell
                                        className={`text-center ${
                                            array.key === 'registered' && slot.registered.length == slot.maxParticipants
                                                ? 'text-red-500'
                                                : 'text-muted-foreground'
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
                                <TableRow className="table-cell border-0 hover:bg-transparent text-center" key={slot.id}>
                                    {slot[array.key].map((voteId) => (
                                        <DialogTrigger key={voteId} asChild>
                                            <TableCell className="py-1 px-0 block bg-background" onClick={() => setCurrentVoteId(voteId)}>
                                                <Button className="p-2 w-full" variant="ghost">
                                                    {votes[voteId].name}
                                                </Button>
                                            </TableCell>
                                        </DialogTrigger>
                                    ))}
                                </TableRow>
                            ))}
                        </>
                    ))}
                </TableBody>
            </Table>
        </Dialog>
    );
}
