'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import DatePicker from '@/components/Datepicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const PollFormSchema = z.object({
    type: z.enum(['1', '2']),
    title: z.string().min(1),
    description: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    slots: z.array(
        z.object({
            startDate: z.date(),
            startTime: z.string(),
            endDate: z.date(),
            endTime: z.string(),
            maxParticipants: z.coerce.number().positive(),
        })
    ),
});

const defaultValues = {
    startDate: new Date(),
    startTime: '12:00',
    endDate: new Date(),
    endTime: '13:30',
    maxParticipants: 10,
};

export default function CreatePoll() {
    const { toast } = useToast();
    const { push } = useRouter();
    const { register, control, handleSubmit, watch } = useForm<z.infer<typeof PollFormSchema>>({
        defaultValues: {
            type: '1',
            slots: [defaultValues],
        },
        resolver: zodResolver(PollFormSchema),
    });
    const type = watch('type');

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'slots',
    });

    const submitPoll = handleSubmit(async (data) => {
        const res = await fetch('/api/poll', {
            method: 'POST',
            body: JSON.stringify({ ...data, type: Number(data.type) }),
        });

        const poll = await res.json();

        if (!res.ok) {
            toast({
                title: poll.message,
                description: 'Veuillez réessayer plus tard',
            });
        } else push(`/poll/${poll.id}`);
    });

    return (
        <div className="m-auto">
            <h1 className="mb-10 text-3xl font-bold">Création du sondage</h1>
            <form onSubmit={submitPoll} className="flex flex-col gap-3">
                <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                        <RadioGroup className="mb-8 flex gap-4" defaultValue={String(field.value)} {...field} onValueChange={field.onChange}>
                            <div>
                                <RadioGroupItem value="1" id="type-1" className="peer hidden" />
                                <Label htmlFor="type-1" className="!ml-0 p-2 cursor-pointer block border peer-data-[state=checked]:border-white">
                                    <p className="mb-2">Sondage libre</p>
                                    <div className="w-32 h-32 bg-primary"></div>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="2" id="type-2" className="peer hidden" />
                                <Label htmlFor="type-2" className="!ml-0 p-2 cursor-pointer block border peer-data-[state=checked]:border-white">
                                    <p className="mb-2">Sondage avec liste d&apos;attente</p>
                                    <div className="w-32 h-32 bg-primary"></div>
                                </Label>
                            </div>
                        </RadioGroup>
                    )}
                />
                <Label htmlFor="title">Titre du sondage*</Label>
                <Input {...register('title')} id="title" />
                <Label htmlFor="description">Description</Label>
                <Textarea {...register('description')} id="description" />
                <Label htmlFor="email">
                    Email
                    <span className="ml-2 text-muted-foreground text-sm">(Servira uniquement à retrouver vos différents sondages)</span>
                </Label>
                <Input className="max-w-xs" {...register('email')} id="email" />
                <h2 className="my-4 text-2xl font-bold">Créneaux</h2>
                <div className="flex flex-wrap gap-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex flex-1 items-center flex-col justify-end border p-4">
                            {index > 0 && (
                                <Button className="ml-auto w-7 h-7" variant="destructive" size="icon" onClick={() => remove(index)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="start">Date de début</Label>
                                <div className="flex flex-wrap gap-2">
                                    <DatePicker control={control} name={`slots.${index}.startDate`} />
                                    <Controller
                                        name={`slots.${index}.startTime`}
                                        control={control}
                                        render={({ field }) => <Input type="time" className="w-fit" {...field} />}
                                    />
                                </div>
                                <Label htmlFor="end">Date de fin</Label>
                                <div className="flex flex-wrap gap-2">
                                    <DatePicker control={control} name={`slots.${index}.endDate`} />
                                    <Controller
                                        name={`slots.${index}.endTime`}
                                        control={control}
                                        render={({ field }) => <Input type="time" className="w-fit" {...field} />}
                                    />
                                </div>
                                {type == '2' && (
                                    <>
                                        <label htmlFor="maxParticipants">Maximum de participants</label>
                                        <Controller
                                            name={`slots.${index}.maxParticipants`}
                                            control={control}
                                            render={({ field }) => <Input type="number" className="w-20" {...field} />}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {fields.length % 2 !== 0 && <div className="hidden p-4 flex-1 sm:block" />}
                </div>
                <Button className="mt-2" type="button" variant="secondary" onClick={() => append(defaultValues)}>
                    Ajouter un créneau
                </Button>
                <Button className="mt-4">Créer</Button>
            </form>
        </div>
    );
}
