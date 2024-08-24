"use client";

import { DatePicker } from "@/components/form/Datepicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { usePoll } from "@/hooks/use-poll";
import { PollFormSchema, pollFormSchema } from "@/lib/schema/poll-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { fromZonedTime } from "date-fns-tz";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { Controller, useFieldArray, useForm } from "react-hook-form";

const slotDefaultValues = {
  startDate: new Date(),
  startTime: "12:00",
  endDate: new Date(),
  endTime: "13:30",
  maxParticipants: 10,
};

export default function CreatePoll() {
  const { createPollMutation } = usePoll();
  const { register, control, handleSubmit, watch } = useForm<PollFormSchema>({
    defaultValues: {
      type: "1",
      timeBeforeAllowedType: "1",
      hoursBeforeAllowed: 1,
      slots: [slotDefaultValues],
    },
    resolver: zodResolver(pollFormSchema),
  });
  const type = watch("type");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "slots",
  });

  const submitPoll = handleSubmit(async (data) => {
    // convert hours to ms
    let msBeforeAllowed = 0;
    if (type === "2" && data.timeBeforeAllowedType === "2") {
      msBeforeAllowed = Number(data.hoursBeforeAllowed) * 60 * 60 * 1000;
      delete data.hoursBeforeAllowed;
    }

    // gen slots utc date from date/time
    const slots = data.slots.map((slot) => {
      const startDate = new Date(slot.startDate);
      const [hours, minutes] = slot.startTime.split(":");
      const slotDateTime = new Date(startDate.setHours(+hours, +minutes, 0, 0));
      const utcSlot = fromZonedTime(slotDateTime, "Europe/Paris");

      const endDate = new Date(slot.endDate);
      const [endHours, endMinutes] = slot.endTime.split(":");
      const endDateTime = new Date(
        endDate.setHours(+endHours, +endMinutes, 0, 0),
      );
      const utcEndSlot = fromZonedTime(endDateTime, "Europe/Paris");

      return {
        maxParticipants: slot.maxParticipants,
        startDate: utcSlot,
        endDate: utcEndSlot,
      };
    });

    createPollMutation.mutate({
      ...data,
      slots,
      email: data.email?.toLowerCase() || undefined,
      type: Number(data.type),
      timeBeforeAllowedType: Number(data.timeBeforeAllowedType),
      msBeforeAllowed,
    });
  });

  return (
    <div className="m-auto max-w-xl">
      <h1 className="mb-10 text-3xl font-bold">Création du sondage</h1>
      <form onSubmit={submitPoll} className="flex flex-col gap-4">
        <p className="text-sm font-semibold">
          Je choisis mon type de sondage...
        </p>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              className="mb-8 flex gap-4"
              defaultValue={String(field.value)}
              {...field}
              onValueChange={field.onChange}
            >
              <div>
                <RadioGroupItem value="1" id="type-1" className="peer hidden" />
                <Label
                  htmlFor="type-1"
                  className="!ml-0 flex h-44 min-w-[150px] cursor-pointer flex-col items-center justify-center rounded border border-[#41414121] p-3 peer-data-[state=checked]:bg-[#d9d9d91a] dark:border-[#ffffff33] dark:peer-data-[state=checked]:bg-[#ffffff1a]"
                >
                  <p className="mb-2">Sondage libre</p>
                  <Image
                    className="w-32 object-cover"
                    width={400}
                    height={400}
                    src="/images/poll-11.png"
                    alt="Sondage libre"
                  />
                </Label>
              </div>
              <div>
                <RadioGroupItem value="2" id="type-2" className="peer hidden" />
                <Label
                  htmlFor="type-2"
                  className="!ml-0 flex h-44 cursor-pointer flex-col items-center justify-center rounded border border-[#41414121] p-3 text-center peer-data-[state=checked]:bg-[#d9d9d91a] dark:border-[#ffffff33] dark:peer-data-[state=checked]:bg-[#ffffff1a]"
                >
                  <p className="mb-2">Sondage avec liste d'attente</p>
                  <Image
                    className="w-32 object-cover"
                    width={400}
                    height={400}
                    src="/images/poll-22.png"
                    alt="Sondage avec liste d'attente"
                  />
                </Label>
              </div>
            </RadioGroup>
          )}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">
            Titre du sondage<span className="text-red-600">*</span>
          </Label>
          <Input {...register("title")} id="title" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea {...register("description")} id="description" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">
              Email
              <span className="ml-2 text-sm text-muted-foreground">
                (Servira uniquement à retrouver vos différents sondages)
              </span>
            </Label>
            <Input {...register("email")} id="email" inputMode="email" />
          </div>
          <div className="flex flex-col justify-between gap-2">
            <Label htmlFor="password">
              Mot de passe
              <span className="ml-2 text-sm text-muted-foreground">
                (Permettra de modifier le sondage)
              </span>
            </Label>
            <Input {...register("password")} id="password" />
          </div>
        </div>
        {type === "2" && (
          <div className="flex flex-col gap-3">
            <Label>Les réinscrits pourront être inscrits à partir de :</Label>
            <Controller
              control={control}
              name="timeBeforeAllowedType"
              render={({ field }) => (
                <RadioGroup
                  className="flex flex-col gap-3"
                  defaultValue={String(field.value)}
                  {...field}
                  onValueChange={field.onChange}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="1" id="timeBeforeAllowedType-1" />
                    <Label
                      htmlFor="timeBeforeAllowedType-1"
                      className="font-normal"
                    >
                      La veille
                      <span className="ml-2 text-sm text-muted-foreground">
                        (à 17h)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="2" id="timeBeforeAllowedType-2" />
                    <Label
                      htmlFor="timeBeforeAllowedType-2"
                      className="flex items-center gap-2 font-normal"
                    >
                      <Input
                        onFocus={() => field.onChange(2)}
                        className="w-14"
                        type="number"
                        {...register("hoursBeforeAllowed")}
                      />
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
            <div
              key={field.id}
              className="flex flex-1 flex-col items-center justify-end border p-4"
            >
              {index > 0 && (
                <Button
                  className="ml-auto h-7 w-7"
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="start">Date de début</Label>
                <div className="flex flex-wrap gap-2">
                  <DatePicker
                    control={control}
                    name={`slots.${index}.startDate`}
                  />
                  <Controller
                    name={`slots.${index}.startTime`}
                    control={control}
                    render={({ field }) => (
                      <Input type="time" className="w-fit" {...field} />
                    )}
                  />
                </div>
                <Label htmlFor="end">Date de fin</Label>
                <div className="flex flex-wrap gap-2">
                  <DatePicker
                    control={control}
                    name={`slots.${index}.endDate`}
                  />
                  <Controller
                    name={`slots.${index}.endTime`}
                    control={control}
                    render={({ field }) => (
                      <Input type="time" className="w-fit" {...field} />
                    )}
                  />
                </div>
                {type == "2" && (
                  <>
                    <label htmlFor="maxParticipants">
                      Maximum de participants
                    </label>
                    <Controller
                      name={`slots.${index}.maxParticipants`}
                      control={control}
                      render={({ field }) => (
                        <Input type="number" className="w-20" {...field} />
                      )}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          {fields.length % 2 !== 0 && (
            <div className="hidden flex-1 p-4 sm:block" />
          )}
        </div>
        <Button
          className="mt-2"
          type="button"
          variant="secondary"
          onClick={() => append(slotDefaultValues)}
        >
          Ajouter un créneau
        </Button>
        <Button disabled={createPollMutation.isPending} className="mt-4">
          Créer
          {createPollMutation.isPending && (
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
          )}
        </Button>
      </form>
    </div>
  );
}
