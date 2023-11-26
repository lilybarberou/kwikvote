import { Controller, useForm } from 'react-hook-form';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDate, sameDay } from '@/lib/utils';
import { useToast } from './ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, CircleUserRound, Edit, HelpCircle, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useVotesStore } from '@/lib/votesStore';
import { v4 } from 'uuid';

type Props = {
    slots: { id: string; startDate: Date; startTime: string; endDate: Date; endTime: string }[];
    pollId: string;
};

export default function PollSlot(props: Props) {
    const { removeVote: deleteVote, addVote, votes } = useVotesStore();
    const { toast } = useToast();
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<{ name: string; [key: string]: string }>();
    const [currentVoteId, setCurrentVoteId] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);

    const TotalUpvotes = ({ slotId }: { slotId: string }) => {
        const total = Object.values(votes).reduce(
            (acc, vote) => {
                const choice = vote.choices.find((choice) => choice.slotId === slotId);
                if (choice?.choice === 1) acc[0]++;
                else if (choice?.choice === 3) acc[1]++;
                return acc;
            },
            [0, 0]
        );

        return (
            <TableCell className="text-center">
                <div className="flex justify-center items-center gap-1 text-green-400">
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
                return <CheckCircle className="w-4 h-4 inline-block text-green-400" />;
            case 2:
                return <XCircle className="w-4 h-4 inline-block text-red-400" />;
            case 3:
                return <HelpCircle className="w-4 h-4 inline-block text-yellow-200" />;
        }
    };

    const submitVote = handleSubmit(async (data) => {
        const formattedData = {
            id: currentVoteId || v4(),
            name: data.name,
            choices: props.slots.map((slot) => {
                const choiceId = votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.id;
                return { id: choiceId || v4(), slotId: slot.id, choice: parseInt(data[`choice-${slot.id}`]) };
            }),
        };

        const res = await fetch('/api/vote', {
            method: 'POST',
            body: JSON.stringify({
                pollId: props.pollId,
                ...formattedData,
            }),
        });

        if (res.ok) {
            addVote(formattedData);
            setDialogOpen(false);
        } else {
            toast({
                title: 'Erreur lors de la création du vote',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        }
    });

    const removeVote = async () => {
        const res = await fetch(`/api/vote/${currentVoteId}`, { method: 'DELETE' });

        if (res.ok) {
            deleteVote(currentVoteId);
            setDialogOpen(false);
        } else {
            toast({
                title: 'Erreur lors de la suppression du vote',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        }
    };

    return (
        <div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-fit">
                    <DialogTitle>Ajouter un vote</DialogTitle>
                    <form onSubmit={submitVote}>
                        <Label className="mt-4" htmlFor="name">
                            Nom
                        </Label>
                        <Input
                            autoFocus
                            className="mt-2 mb-4"
                            defaultValue={votes[currentVoteId]?.name ?? ''}
                            placeholder="John Doe"
                            {...register('name', { required: true })}
                        />
                        <div>
                            {props.slots.map((slot, index) => (
                                <div key={slot.id} className={`py-2 grid grid-cols-2 items-center ${props.slots.length - 1 === index ? '' : 'border-b-2'}`}>
                                    <div>
                                        <p>{getDate(slot.startDate)}</p>
                                        <p className="text-sm text-muted-foreground">{slot.startTime}</p>
                                    </div>
                                    <div>
                                        <Controller
                                            control={control}
                                            rules={{ required: true }}
                                            name={`choice-${slot.id}`}
                                            defaultValue={votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.choice.toString() ?? ''}
                                            render={({ field }) => (
                                                <Select {...field} onValueChange={field.onChange}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="À définir" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">Oui</SelectItem>
                                                        <SelectItem value="2">Non</SelectItem>
                                                        <SelectItem value="3">Ne sais pas</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors[`choice-${slot.id}`] && <p className="ml-auto text-sm text-destructive">Champ requis</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DialogFooter className="mt-4">
                            {currentVoteId && (
                                <Button onClick={removeVote} type="button" size="icon" variant="destructive" className="mr-auto">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            <div className="flex gap-2">
                                <DialogClose asChild>
                                    <Button variant="outline">Annuler</Button>
                                </DialogClose>
                                <Button type="submit">Confirmer</Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <DialogTrigger asChild>
                                    <Button onClick={() => setCurrentVoteId('')}>Nouveau vote</Button>
                                </DialogTrigger>
                            </TableHead>
                            {props.slots.map((slot) => (
                                <TableHead key={slot.id} className="py-4">
                                    {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                                        <div className="text-center">
                                            <p>{getDate(slot.startDate)}</p>
                                            <p>{slot.startTime}</p>
                                            <p>{slot.endTime}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p>{getDate(slot.startDate)}</p>
                                            <p>{slot.startTime}</p>
                                            <p>{getDate(slot.endDate)}</p>
                                            <p>{slot.endTime}</p>
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
                                Total{' '}
                                <span className="flex gap-1">
                                    {Object.keys(votes).length} <CircleUserRound className="w-5 h-5" />
                                </span>
                            </TableCell>
                            {props.slots.map((slot) => (
                                <TotalUpvotes slotId={slot.id} key={slot.id} />
                            ))}
                            <TableCell />
                        </TableRow>
                        {Object.values(votes).map((vote) => (
                            <TableRow key={vote.id}>
                                <TableCell className="py-2">{vote.name}</TableCell>
                                {vote.choices.map((choice) => (
                                    <TableCell className="py-2 text-center" key={choice.id}>
                                        <VoteIcon choice={choice.choice} />
                                    </TableCell>
                                ))}
                                <TableCell className="py-2">
                                    <DialogTrigger asChild>
                                        <Button onClick={() => setCurrentVoteId(vote.id)} className="w-8 h-8" size="icon" variant="outline">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                    </DialogTrigger>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Dialog>
        </div>
    );
}
