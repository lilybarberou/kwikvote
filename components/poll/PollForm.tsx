"use client";

import { DatePicker } from "@/components/form/Datepicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePoll } from "@/hooks/use-poll";
import { PollFormSchema, pollFormSchema } from "@/lib/schema/poll-schema";
import { parisDateTimeToUtc } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { Controller, useFieldArray, useForm } from "react-hook-form";

// the message of an invalid field, linked to it by aria-describedby
const FieldError = (props: { id: string; show: boolean; message: string }) =>
  props.show ? (
    <p id={props.id} className="text-sm text-destructive dark:text-red-400">
      {props.message}
    </p>
  ) : null;

const slotDefaultValues = {
  startDate: new Date(),
  startTime: "12:00",
  endDate: new Date(),
  endTime: "13:30",
  maxParticipants: 10,
};

export const PollForm = () => {
  const { createPollMutation } = useCreatePoll();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PollFormSchema>({
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
    const slots = data.slots.map((slot) => ({
      maxParticipants: slot.maxParticipants,
      startDate: parisDateTimeToUtc(slot.startDate, slot.startTime),
      endDate: parisDateTimeToUtc(slot.endDate, slot.endTime),
    }));

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
    <form onSubmit={submitPoll} className="flex flex-col gap-4">
      <p id="type-label" className="text-sm font-semibold">
        Je choisis mon type de sondage...
      </p>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <RadioGroup
            aria-labelledby="type-label"
            className="mb-8 flex gap-4"
            defaultValue={String(field.value)}
            {...field}
            onValueChange={field.onChange}
          >
            {/*
              the chosen card: a primary border doubled by an outline (2px
              without moving the layout, contrast above 3:1 in both themes)
            */}
            <div>
              {/* sr-only, not hidden: the radios stay reachable with the keyboard */}
              <RadioGroupItem value="1" id="type-1" className="peer sr-only" />
              <Label
                htmlFor="type-1"
                className="!ml-0 flex h-44 min-w-[150px] cursor-pointer flex-col items-center justify-center rounded border border-[#41414121] p-3 ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-[#d9d9d91a] peer-data-[state=checked]:outline peer-data-[state=checked]:outline-1 peer-data-[state=checked]:outline-primary dark:border-[#ffffff33] dark:peer-data-[state=checked]:border-primary dark:peer-data-[state=checked]:bg-[#ffffff1a]"
              >
                <p className="mb-2">Sondage libre</p>
                <Image
                  className="w-32 object-cover"
                  width={400}
                  height={400}
                  // above the fold, the largest image of the page (LCP)
                  loading="eager"
                  sizes="128px"
                  src="/images/poll-11.png"
                  // the label text names the choice
                  alt=""
                />
              </Label>
            </div>
            <div>
              <RadioGroupItem value="2" id="type-2" className="peer sr-only" />
              <Label
                htmlFor="type-2"
                className="!ml-0 flex h-44 cursor-pointer flex-col items-center justify-center rounded border border-[#41414121] p-3 text-center ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-[#d9d9d91a] peer-data-[state=checked]:outline peer-data-[state=checked]:outline-1 peer-data-[state=checked]:outline-primary dark:border-[#ffffff33] dark:peer-data-[state=checked]:border-primary dark:peer-data-[state=checked]:bg-[#ffffff1a]"
              >
                <p className="mb-2">Sondage avec liste d'attente</p>
                <Image
                  className="w-32 object-cover"
                  width={400}
                  height={400}
                  // above the fold, the largest image of the page (LCP)
                  loading="eager"
                  sizes="128px"
                  src="/images/poll-22.png"
                  alt=""
                />
              </Label>
            </div>
          </RadioGroup>
        )}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">
          Titre du sondage
          <span aria-hidden className="text-red-600">
            *
          </span>
        </Label>
        <Input
          {...register("title")}
          id="title"
          aria-required
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "error-title" : undefined}
        />
        <FieldError
          id="error-title"
          show={!!errors.title}
          message="Champ requis"
        />
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
          <Input
            {...register("email")}
            id="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "error-email" : undefined}
          />
          <FieldError
            id="error-email"
            show={!!errors.email}
            message="Email invalide"
          />
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
          <Label id="time-before-allowed-label">
            Les réinscrits pourront être inscrits à partir de :
          </Label>
          <Controller
            control={control}
            name="timeBeforeAllowedType"
            render={({ field }) => (
              // not {...field}: its onChange would also get the change events of the hours input
              <RadioGroup
                aria-labelledby="time-before-allowed-label"
                className="flex flex-col gap-3"
                value={field.value}
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
                      aria-label="Nombre d'heures avant la date de début"
                      onFocus={() => field.onChange("2")}
                      className="w-14"
                      type="number"
                      aria-invalid={!!errors.hoursBeforeAllowed}
                      aria-describedby={
                        errors.hoursBeforeAllowed
                          ? "error-hoursBeforeAllowed"
                          : undefined
                      }
                      {...register("hoursBeforeAllowed")}
                    />
                    <p>h avant la date de début</p>
                  </Label>
                  <FieldError
                    id="error-hoursBeforeAllowed"
                    show={!!errors.hoursBeforeAllowed}
                    message="Nombre d'heures invalide"
                  />
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
                aria-label="Supprimer le créneau"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col gap-2">
              <Label>Date de début</Label>
              <div className="flex flex-wrap gap-2">
                <DatePicker
                  label="Date de début"
                  control={control}
                  name={`slots.${index}.startDate`}
                />
                <Controller
                  name={`slots.${index}.startTime`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="time"
                      className="w-fit"
                      aria-label="Heure de début"
                      {...field}
                    />
                  )}
                />
              </div>
              <Label>Date de fin</Label>
              <div className="flex flex-wrap gap-2">
                <DatePicker
                  label="Date de fin"
                  control={control}
                  name={`slots.${index}.endDate`}
                />
                <Controller
                  name={`slots.${index}.endTime`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="time"
                      className="w-fit"
                      aria-label="Heure de fin"
                      {...field}
                    />
                  )}
                />
              </div>
              {type == "2" && (
                <>
                  <label htmlFor={`slots.${index}.maxParticipants`}>
                    Maximum de participants
                  </label>
                  <Controller
                    name={`slots.${index}.maxParticipants`}
                    control={control}
                    render={({ field }) => (
                      <Input
                        id={`slots.${index}.maxParticipants`}
                        type="number"
                        className="w-20"
                        aria-invalid={!!errors.slots?.[index]?.maxParticipants}
                        aria-describedby={
                          errors.slots?.[index]?.maxParticipants
                            ? `error-slots.${index}.maxParticipants`
                            : undefined
                        }
                        {...field}
                      />
                    )}
                  />
                  <FieldError
                    id={`error-slots.${index}.maxParticipants`}
                    show={!!errors.slots?.[index]?.maxParticipants}
                    message="Nombre invalide"
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
  );
};
