"use client";

import { usePoll } from "@/hooks/use-poll";
import { useSlot } from "@/hooks/use-slot";
import { GetPollById } from "@/lib/api/poll/query";
import {
  PollSettingsSchema,
  pollSettingsSchema,
} from "@/lib/schema/poll-schema";
import { cn, getDate, sameDay, timeTwoDigit } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { PopoverClose } from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsIcon, TrashIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useStep } from "usehooks-ts";

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
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";

const Context = createContext({
  goToNextStep: () => {},
  poll: {} as GetPollById,
});
const useProvider = () => useContext(Context);

export const PollSettingsDialog = () => {
  const [step, helpers] = useStep(2);

  const queryClient = useQueryClient();
  const params = useParams() as { id: string };
  const poll = queryClient.getQueryData<GetPollById>([
    "getPollById",
    params.id,
  ]);

  return (
    <Context.Provider value={{ ...helpers, poll }}>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost">
            <SettingsIcon />
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(step === 1 && "w-[400px]")}>
          <DialogHeader>Paramètres du sondage</DialogHeader>
          {step === 1 && <FirstStep />}
          {step === 2 && <SecondStep />}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
};

const FirstStep = () => {
  const { goToNextStep } = useProvider();
  const inputPassword = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);
  const { poll } = useProvider();

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();

    const password = inputPassword.current?.value;
    if (password === poll?.password || password === process.env.ADMIN_PASSWORD)
      goToNextStep();
    else setError(true);
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
      <SlotsDeleteTab />
    </Accordion>
  );
};

const SlotsDeleteTab = () => {
  const { deleteSlotByIdMutation } = useSlot();
  const { poll } = useProvider();

  return (
    <AccordionItem value="slots">
      <AccordionTrigger>Gérer les créneaux</AccordionTrigger>
      <AccordionContent className="grid grid-cols-3 pt-3 px-1">
        {poll?.slots.map((slot) => (
          <div key={slot.id} className="whitespace-nowrap text-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" className="mb-2">
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex items-center flex-col gap-2 max-w-[200px]">
                <p className="text-sm text-center">
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
                  onClick={() => deleteSlotByIdMutation.mutate(slot.id)}
                  disabled={deleteSlotByIdMutation.isPending}
                >
                  Supprimer
                </Button>
              </PopoverContent>
            </Popover>
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

const ManagePollTab = () => {
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
    updatePollMutation.mutate(data, {
      onSuccess: () => {
        reset(data);
      },
    });
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
          <PopoverContent className="flex items-center flex-col gap-2 max-w-[200px]">
            <p className="text-sm text-center">
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
              onClick={() => deletePollMutation.mutate(params.id)}
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
