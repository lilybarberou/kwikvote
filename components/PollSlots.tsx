import { Controller, useForm } from 'react-hook-form';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDate, getTime, sameDay } from '@/lib/utils';
import { useToast } from './ui/use-toast';

type Props = {
    slots: { id: string; startDate: Date; startTime: string; endDate: Date; endTime: string }[];
    votes: { id: string; name: string; choices: { id: string; choice: number; slotId: string }[] }[];
    pollId: string;
};

export default function PollSlot(props: Props) {
    const { toast } = useToast();
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<{ name: string; [key: string]: string }>();

    const TotalUpvotes = ({ slotId }: { slotId: string }) => {
        const total = props.votes.reduce(
            (acc, vote) => {
                const choice = vote.choices.find((choice) => choice.slotId === slotId);
                if (choice?.choice === 1) acc[0]++;
                else if (choice?.choice === 3) acc[1]++;
                return acc;
            },
            [0, 0]
        );

        return (
            <td className="text-green-400">
                {total[0]} {total[1] > 0 && <span className="text-yellow-200">+ {total[1]}</span>}
            </td>
        );
    };

    const submitVote = handleSubmit(async (data) => {
        console.log(data);
        const res = await fetch('/api/vote', {
            method: 'POST',
            body: JSON.stringify({
                name: data.name,
                pollId: props.pollId,
                choices: props.slots.map((slot) => ({ slotId: slot.id, choice: parseInt(data[`choice-${slot.id}`]) })),
            }),
        });

        if (!res.ok) {
            toast({
                title: 'Erreur lors de la création du vote',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        }
    });

    return (
        <div>
            <Dialog>
                <DialogTrigger asChild>
                    <Button>Nouveau vote</Button>
                </DialogTrigger>
                <DialogContent className="max-w-fit">
                    <DialogTitle>Ajouter un vote</DialogTitle>
                    <form onSubmit={submitVote}>
                        <Label className="mt-4" htmlFor="name">
                            Nom
                        </Label>
                        <Input autoFocus className="mt-2 mb-4" placeholder="John Doe" {...register('name', { required: true })} />
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
                            <DialogClose asChild>
                                <Button variant="destructive">Annuler</Button>
                            </DialogClose>
                            <Button type="submit">Confirmer</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                {props.slots.map((slot) => (
                                    <th key={slot.id}>
                                        {sameDay(new Date(slot.startDate), new Date(slot.endDate)) ? (
                                            <div>
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
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{props.votes.length}</td>
                                {props.slots.map((slot) => (
                                    <TotalUpvotes slotId={slot.id} key={slot.id} />
                                ))}
                            </tr>
                            {props.votes.map((vote) => (
                                <tr key={vote.id}>
                                    <td>{vote.name}</td>
                                    {vote.choices.map((choice) => (
                                        <td key={choice.id}>{choice.choice}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Dialog>
        </div>
    );
}
