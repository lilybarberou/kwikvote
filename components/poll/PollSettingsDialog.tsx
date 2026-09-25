"use client";

import { usePoll } from "@/hooks/use-poll";
import { useSlot } from "@/hooks/use-slot";
import { GetPollById } from "@/lib/api/poll/query";
import {
  PollSettingsSchema,
  pollSettingsSchema,
} from "@/lib/schema/poll-schema";
import { SlotFormSchema, slotFormSchema } from "@/lib/schema/slot-schema";
import { useNotificationsStore } from "@/lib/store/notificationsStore";
import {
  cn,
  getDate,
  parisDateTimeToUtc,
  sameDay,
  timeTwoDigit,
  utcToParisDateTime,
} from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { PopoverClose } from "@radix-ui/react-popover";
import { startOfDay } from "date-fns";
import { PencilIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useStep } from "usehooks-ts";

import { DatePicker } from "../form/Datepicker";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";

const Context = createContext({
  goToNextStep: () => {},
  poll: {} as GetPollById,
  password: "",
  setPassword: (pw: string) => {},
});
const useProvider = () => useContext(Context);

export const PollSettingsDialog = () => {
  const [step, helpers] = useStep(2);
  const [password, setPassword] = useState("");

  const {
    getPollByIdQuery: { data: poll },
  } = usePoll({ enabled: { getPollById: true } });

  return (
    <Context.Provider
      value={{ ...helpers, poll: poll!, password, setPassword }}
    >
      <Dialog>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost">
            <SettingsIcon />
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(step === 1 && "w-11/12 max-w-[400px]")}>
          <DialogHeader className="text-left">
            Paramètres du sondage
          </DialogHeader>
          {step === 1 && <FirstStep />}
          {step === 2 && <SecondStep />}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
};

const FirstStep = () => {
  const { goToNextStep, setPassword } = useProvider();
  const inputPassword = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);
  const { checkPollPasswordMutation } = usePoll();

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputPassword.current?.value;
    if (!password) return;

    checkPollPasswordMutation.mutate(password, {
      onSuccess: (isValid) => {
        if (isValid) {
          goToNextStep();
          setPassword(password);
        } else setError(true);
      },
    });
  };

  return (
    <form onSubmit={submitPassword} className="flex flex-col gap-2">
      <p className={cn(error && "text-red-800")}>Mot de passe</p>
      <Input ref={inputPassword} className={cn(error && "border-red-800")} />
      <Button type="submit" className="mt-3">
        Valider
      </Button>
    </form>
  );
};

const SecondStep = () => {
  return (
    <Accordion type="single" collapsible>
      <ManagePollTab />
      <SlotsTab />
    </Accordion>
  );
};

const SlotsTab = () => {
  const { deleteSlotByIdMutation } = useSlot();
  const { poll, password } = useProvider();

  return (
    <AccordionItem value="slots">
      <AccordionTrigger>Gérer les créneaux</AccordionTrigger>
      <AccordionContent className="grid grid-cols-3 px-1 pt-3">
        {poll?.slots.map((slot) => (
          <div key={slot.id} className="whitespace-nowrap text-center">
            <div className="mb-2 flex justify-center gap-2">
              <EditSlotDialog slot={slot} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    aria-label={`Supprimer le créneau du ${getDate(slot.startDate)} ${timeTwoDigit(slot.startDate)}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex max-w-[200px] flex-col items-center gap-2">
                  <p className="text-center text-sm">
                    Confirmer la suppression du créneau
                  </p>
                  <PopoverClose asChild>
                    <Button className="w-full" variant="outline">
                      Annuler
                    </Button>
                  </PopoverClose>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() =>
                      deleteSlotByIdMutation.mutate({
                        slotId: slot.id,
                        password,
                      })
                    }
                    disabled={deleteSlotByIdMutation.isPending}
                  >
                    Supprimer
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
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
        ))}
      </AccordionContent>
    </AccordionItem>
  );
};

const getSlotFormValues = (slot: { startDate: Date; endDate: Date }) => {
  const start = utcToParisDateTime(slot.startDate);
  const end = utcToParisDateTime(slot.endDate);
  return {
    // start of day like the dates picked in the calendar, to compare them
    startDate: startOfDay(start.date),
    startTime: start.time,
    endDate: startOfDay(end.date),
    endTime: end.time,
  };
};

const EditSlotDialog = ({
  slot,
}: {
  slot: NonNullable<GetPollById>["slots"][number];
}) => {
  const [open, setOpen] = useState(false);
  const { poll, password } = useProvider();
  const { updateSlotByIdMutation } = useSlot();
  const { subscription } = useNotificationsStore();

  const {
    control,
    formState: { dirtyFields, errors, isDirty },
    handleSubmit,
    reset,
  } = useForm<SlotFormSchema>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: getSlotFormValues(slot),
  });

  const onOpenChange = (open: boolean) => {
    if (open) reset(getSlotFormValues(slot));
    setOpen(open);
  };

  const onSubmit = handleSubmit((data) => {
    // untouched start or end is sent as stored, never converted back
    const isStartUpdated = dirtyFields.startDate || dirtyFields.startTime;
    const isEndUpdated = dirtyFields.endDate || dirtyFields.endTime;

    updateSlotByIdMutation.mutate(
      {
        slotId: slot.id,
        password,
        startDate: isStartUpdated
          ? parisDateTimeToUtc(data.startDate, data.startTime)
          : slot.startDate,
        endDate: isEndUpdated
          ? parisDateTimeToUtc(data.endDate, data.endTime)
          : slot.endDate,
        exceptEndpoint: subscription?.endpoint,
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  });

  // end after start error is on endTime, revalidated when any date/time changes (deps)
  const errorMessage =
    errors.endTime?.type === "custom"
      ? errors.endTime.message
      : Object.keys(errors).length > 0 && "Date ou heure invalide";

  // the form is in france time, like the creation form
  const isNotParisTime =
    timeTwoDigit(slot.startDate) !== utcToParisDateTime(slot.startDate).time;
  const parisTimeHint = isNotParisTime && (
    <span className="ml-2 text-sm text-muted-foreground">(heure de Paris)</span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label={`Modifier le créneau du ${getDate(slot.startDate)} ${timeTwoDigit(slot.startDate)}`}
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-11/12 max-w-[400px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-normal">
            Modifier le créneau
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Label>Date de début{parisTimeHint}</Label>
          <div className="flex flex-wrap gap-2">
            <DatePicker
              control={control}
              name="startDate"
              rules={{ deps: "endTime" }}
            />
            <Controller
              name="startTime"
              control={control}
              rules={{ deps: "endTime" }}
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
          <Label>Date de fin{parisTimeHint}</Label>
          <div className="flex flex-wrap gap-2">
            <DatePicker
              control={control}
              name="endDate"
              rules={{ deps: "endTime" }}
            />
            <Controller
              name="endTime"
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
          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {poll.type === 2 &&
              "Les inscrits et listes d'attente seront recalculés selon le nouvel horaire. "}
            Les participants ayant activé les notifications seront prévenus.
          </p>
          <Button
            type="submit"
            className="mt-3"
            disabled={!isDirty || updateSlotByIdMutation.isPending}
          >
            Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ManagePollTab = () => {
  const router = useRouter();
  const { password } = useProvider();
  const params = useParams() as { id: string };
  const {
    deletePollMutation,
    getPollByIdQuery: { data: poll },
    updatePollMutation,
  } = usePoll({ enabled: { getPollById: true } });

  const {
    formState: { isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<PollSettingsSchema>({
    resolver: zodResolver(pollSettingsSchema),
    defaultValues: {
      title: poll?.title,
      description: poll?.description,
    },
  });

  const onSubmit = handleSubmit((data) => {
    updatePollMutation.mutate(
      { ...data, password },
      {
        onSuccess: () => {
          reset(data);
        },
      },
    );
  });

  return (
    <AccordionItem value="poll">
      <AccordionTrigger>Gérer le sondage</AccordionTrigger>
      <AccordionContent className="px-1">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">
              Titre du sondage<span className="text-red-600">*</span>
            </Label>
            <Input id="title" {...register("title")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} />
          </div>
          <Button
            disabled={!isDirty || updatePollMutation.isPending}
            type="submit"
          >
            Enregistrer
          </Button>
        </form>
        <div className="my-4 h-px w-full bg-input" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="destructive" type="button">
              Supprimer le sondage
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex max-w-[200px] flex-col items-center gap-2">
            <p className="text-center text-sm">
              Confirmer la suppression du sondage
            </p>
            <PopoverClose asChild>
              <Button className="w-full" variant="outline">
                Annuler
              </Button>
            </PopoverClose>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() =>
                deletePollMutation.mutate(
                  { pollId: params.id, password },
                  {
                    onSuccess: () => {
                      router.push(`/`);
                    },
                  },
                )
              }
              disabled={deletePollMutation.isPending}
            >
              Supprimer
            </Button>
          </PopoverContent>
        </Popover>
      </AccordionContent>
    </AccordionItem>
  );
};
