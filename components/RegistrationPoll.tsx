import { useState } from 'react';
import { getDate, sameDay } from '@/lib/utils';
import { useVotesStore } from '@/lib/votesStore';
import { PollSlot } from '@/app/api/poll/id/[value]/route';
import { Dialog, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DialogVote from './DialogVote';

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
                <Button className="mt-10 mb-2" onClick={() => setCurrentVoteId('')}>
                    Nouvelle inscription
                </Button>
            </DialogTrigger>
            <Table>
                <TableHeader>
                    <TableRow>
                        {slots.map((slot) => (
                            <TableHead key={slot.id} className="py-4">
                                {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                                    <div className="text-center whitespace-nowrap">
                                        <p>{getDate(slot.startDate)}</p>
                                        <p>{slot.startTime}</p>
                                        <p>{slot.endTime}</p>
                                        <p className={slot.registered.length == slot.maxParticipants ? 'text-red-500' : ''}>
                                            {slot.registered.length}/{slot.maxParticipants}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p>{getDate(slot.startDate)}</p>
                                        <p>{slot.startTime}</p>
                                        <p>{getDate(slot.endDate)}</p>
                                        <p>{slot.endTime}</p>
                                        <p className={slot.registered.length == slot.maxParticipants ? 'text-red-500' : ''}>
                                            {slot.registered.length}/{slot.maxParticipants}
                                        </p>
                                    </>
                                )}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {slotArraysLabel.map((array) => (
                        <>
                            <TableRow key={array.key}>
                                <TableCell colSpan={slots.length} className="py-2 font-bold bg-slate-800">
                                    {array.label}
                                </TableCell>
                            </TableRow>
                            {slots.map((slot) => (
                                <TableRow className="table-cell hover:bg-transparent text-center" key={slot.id}>
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
