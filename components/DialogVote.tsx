import { SetStateAction, useEffect } from 'react';
import { v4 } from 'uuid';
import { Controller, useForm } from 'react-hook-form';
import { useVotesStore } from '@/lib/votesStore';
import { getDate } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DialogClose, DialogContent, DialogFooter, DialogTitle } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotificationsStore } from '@/lib/notificationsStore';
import { PollSlot } from '@/app/api/poll/id/[value]/route';

type Props = {
    slots: { id: string; startDate: Date; startTime: string; endDate: Date; endTime: string }[];
    pollId: string;
    pollType: number;
    currentVoteId: string;
    closeDialog: () => void;
    setSlots: React.Dispatch<SetStateAction<PollSlot[]>>;
};

export default function DialogVote(props: Props) {
    const { currentVoteId, slots, closeDialog, pollId } = props;
    const { removeVote: deleteVote, addVote, votes } = useVotesStore();
    const { subscriptionEndpoint } = useNotificationsStore();
    const { toast } = useToast();
    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors },
    } = useForm<{ name: string; [key: string]: string }>();

    useEffect(() => {
        reset();
    }, [currentVoteId, reset]);

    const submitVote = handleSubmit(async (data) => {
        // if data has not been modified, do not submit
        if (currentVoteId && votes[currentVoteId]?.choices.every((choice) => choice.choice === parseInt(data[`choice-${choice.slotId}`]))) {
            closeDialog();
            return;
        }

        const formattedData = {
            id: currentVoteId || v4(),
            name: data.name,
            choices: slots.map((slot) => {
                const choiceId = votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.id;
                return { id: choiceId || v4(), slotId: slot.id, choice: parseInt(data[`choice-${slot.id}`]) };
            }),
            subscriptionEndpoint: subscriptionEndpoint || '',
        };

        const res = await fetch('/api/vote', {
            method: 'POST',
            body: JSON.stringify({
                pollId,
                pollType: props.pollType,
                ...formattedData,
            }),
        });

        if (res.ok) {
            if (props.pollType == 2) {
                const resData = await res.json();
                props.setSlots((prevSlots) => prevSlots.map((slot) => ({ ...slot, ...resData.newSlotsArrays[slot.id] })));
            }

            addVote(formattedData);
            closeDialog();
            reset();
        } else {
            toast({
                title: 'Erreur lors de la création du vote',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        }
    });

    const removeVote = async () => {
        const res = await fetch(`/api/vote/${currentVoteId}`, {
            method: 'DELETE',
            body: JSON.stringify({ pollId, pollType: props.pollType }),
        });

        if (res.ok) {
            if (props.pollType == 1) deleteVote(currentVoteId);
            else if (props.pollType == 2) {
                props.setSlots((prevSlots) =>
                    prevSlots.map((slot) => ({
                        ...slot,
                        registered: slot.registered.filter((id) => id !== currentVoteId),
                        waitingList: slot.waitingList.filter((id) => id !== currentVoteId),
                        waitingListReregistered: slot.waitingListReregistered.filter((id) => id !== currentVoteId),
                        notComing: slot.notComing.filter((id) => id !== currentVoteId),
                    }))
                );
            }

            closeDialog();
        } else {
            toast({
                title: 'Erreur lors de la suppression du vote',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        }
    };

    const DialogTitleBySlotType = () => {
        let text = '';
        if (props.pollType == 1) {
            text = currentVoteId ? 'Modifier un vote' : 'Ajouter un vote';
        } else if (props.pollType == 2) {
            text = currentVoteId ? 'Modifier une inscription' : 'Ajouter une inscription';
        }

        return <DialogTitle>{text}</DialogTitle>;
    };

    return (
        <DialogContent className="w-11/12 max-w-[360px]">
            <DialogTitleBySlotType />
            <form onSubmit={submitVote}>
                <Label className="mt-4" htmlFor="name">
                    Nom
                </Label>
                <Input
                    autoFocus
                    className="mt-2 mb-4"
                    id="name"
                    defaultValue={votes[currentVoteId]?.name ?? ''}
                    placeholder="John Doe"
                    {...register('name', { required: true })}
                />
                <div>
                    {slots.map((slot, index) => (
                        <div
                            key={slot.id}
                            className={`py-4 flex flex-wrap gap-x-14 gap-y-3 items-center sm:py-2 sm:grid sm:grid-cols-[max-content_auto] ${
                                slots.length - 1 === index ? '' : 'border-b-2'
                            }`}
                        >
                            <div className="flex flex-wrap items-end gap-x-2 sm:flex-col sm:items-start">
                                <p>{getDate(slot.startDate)}</p>
                                <p className="text-sm text-muted-foreground">{slot.startTime}</p>
                            </div>
                            <div className="flex-1">
                                <Controller
                                    control={control}
                                    rules={{ required: true }}
                                    name={`choice-${slot.id}`}
                                    defaultValue={votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.choice.toString() ?? ''}
                                    render={({ field }) => (
                                        <Select {...field} onValueChange={field.onChange}>
                                            <SelectTrigger className="min-w-[180px]">
                                                <SelectValue placeholder="À définir" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Oui</SelectItem>
                                                <SelectItem value="2">Non</SelectItem>
                                                {props.pollType == 1 && <SelectItem value="3">Ne sais pas</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors[`choice-${slot.id}`] && <p className="ml-auto text-sm text-destructive">Champ requis</p>}
                            </div>
                        </div>
                    ))}
                </div>
                <DialogFooter className="mt-4 flex-row">
                    {currentVoteId && (
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <Button className="mr-auto" onClick={removeVote} type="button" size="icon" variant="destructive">
                                        <Trash2 className="w-4 h-4" />
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
                        <Button type="submit">Confirmer</Button>
                    </div>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}
