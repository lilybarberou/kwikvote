'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import DatePicker from '@/components/Datepicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';
import { useState } from 'react';
import { Card } from '@/components/ui/card';

const PollFormSchema = z.object({
    type: z.enum(['1', '2']),
    title: z.string().min(1),
    description: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    timeBeforeAllowedType: z.enum(['1', '2']),
    hoursBeforeAllowed: z.number().positive().optional().or(z.string().regex(/^\d+$/)),
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
    const [submitLoading, setSubmitLoading] = useState(false);
    const { toast } = useToast();
    const { push } = useRouter();
    const { register, control, handleSubmit, watch } = useForm<z.infer<typeof PollFormSchema>>({
        defaultValues: {
            type: '1',
            timeBeforeAllowedType: '1',
            hoursBeforeAllowed: 1,
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
        // convert hours to ms
        let msBeforeAllowed = 0;
        if (type === '2' && data.timeBeforeAllowedType === '2') {
            msBeforeAllowed = Number(data.hoursBeforeAllowed) * 60 * 60 * 1000;
            delete data.hoursBeforeAllowed;
        }

        setSubmitLoading(true);
        const res = await fetch('/api/poll', {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                type: Number(data.type),
                timeBeforeAllowedType: Number(data.timeBeforeAllowedType),
                msBeforeAllowed,
            }),
        });

        const poll = await res.json();

        if (!res.ok) {
            setSubmitLoading(false);
            toast({
                title: poll.message,
                description: 'Veuillez réessayer plus tard',
            });
        } else push(`/poll/${poll.id}`);
    });

    return (
        <div className="m-auto">
            <h1 className="mb-10 text-3xl font-bold">Création du sondage</h1>
            <form onSubmit={submitPoll} className="flex flex-col gap-4">
                <p className="text-sm font-semibold">Je choisis mon type de sondage...</p>
                <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                        <RadioGroup className="mb-8 flex gap-4" defaultValue={String(field.value)} {...field} onValueChange={field.onChange}>
                            <div>
                                <RadioGroupItem value="1" id="type-1" className="peer hidden" />
                                <Label
                                    htmlFor="type-1"
                                    className="!ml-0 p-3 min-w-[150px] h-44 flex flex-col justify-center items-center cursor-pointer rounded border border-[#ffffff33] peer-data-[state=checked]:bg-[#ffffff1a]"
                                >
                                    <p className="mb-2">Sondage libre</p>
                                    <Image className="w-32 object-cover" width={400} height={400} src="/poll-11.png" alt="Sondage libre" />
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="2" id="type-2" className="peer hidden" />
                                <Label
                                    htmlFor="type-2"
                                    className="!ml-0 p-3 h-44 flex flex-col justify-center items-center cursor-pointer rounded border border-[#ffffff33] text-center peer-data-[state=checked]:bg-[#ffffff1a]"
                                >
                                    <p className="mb-2">Sondage avec liste d&apos;attente</p>
                                    <Image className="w-32 object-cover" width={400} height={400} src="/poll-22.png" alt="Sondage avec liste d'attente" />
                                </Label>
                            </div>
                        </RadioGroup>
                    )}
                />
                <div className="flex flex-col gap-2">
                    <Label htmlFor="title">Titre du sondage*</Label>
                    <Input className="max-w-[550px] lg:w-1/2" {...register('title')} id="title" />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea {...register('description')} id="description" />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="email">
                        Email
                        <span className="ml-2 text-muted-foreground text-sm">(Servira uniquement à retrouver vos différents sondages)</span>
                    </Label>
                    <Input className="max-w-xs" {...register('email')} id="email" />
                </div>
                {type === '2' && (
                    <div className="flex flex-col gap-3">
                        <Label>Les réinscrits pourront être inscrits à partir de :</Label>
                        <Controller
                            control={control}
                            name="timeBeforeAllowedType"
                            render={({ field }) => (
                                <RadioGroup className="flex flex-col gap-3" defaultValue={String(field.value)} {...field} onValueChange={field.onChange}>
                                    <div className="flex gap-3 items-center">
                                        <RadioGroupItem value="1" id="timeBeforeAllowedType-1" />
                                        <Label htmlFor="timeBeforeAllowedType-1" className="font-normal">
                                            La veille
                                            <span className="ml-2 text-muted-foreground text-sm">(à 17h)</span>
                                        </Label>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <RadioGroupItem value="2" id="timeBeforeAllowedType-2" />
                                        <Label htmlFor="timeBeforeAllowedType-2" className="flex gap-2 items-center font-normal">
                                            <Input onFocus={() => field.onChange(2)} className="w-14" type="number" {...register('hoursBeforeAllowed')} />
                                            <p>h avant la date de début</p>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />
                    </div>
                )}
                <h2 className="my-4 text-2xl font-bold">Créneaux</h2>
                <div className="flex flex-wrap gap-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex flex-1 items-center flex-col justify-end border p-4">
                            {index > 0 && (
                                <Button className="ml-auto w-7 h-7" type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
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
                <Button disabled={submitLoading} className="mt-4">
                    Créer
                    {submitLoading && <Loader2 className="ml-2 w-5 h-5 animate-spin" />}
                </Button>
            </form>
        </div>
    );
}
