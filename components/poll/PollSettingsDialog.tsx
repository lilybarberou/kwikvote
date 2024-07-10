"use client";

import { usePoll } from "@/hooks/use-poll";
import { useSlot } from "@/hooks/use-slot";
import { GetPollById } from "@/lib/api/poll/query";
import { cn, getDate, sameDay, timeTwoDigit } from "@/lib/utils";
import { PopoverClose } from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsIcon, TrashIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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
      <SlotsDeleteTab />
      <ManagePollTab />
    </Accordion>
  );
};

const SlotsDeleteTab = () => {
  const { deleteSlotByIdMutation } = useSlot();
  const { poll } = useProvider();

  return (
    <AccordionItem value="slots">
      <AccordionTrigger>Gérer les créneaux</AccordionTrigger>
      <AccordionContent className="grid grid-cols-3 pt-3">
        {poll?.slots.map((slot) => (
          <div key={slot.id} className="whitespace-nowrap text-center">
            <Popover>
              <PopoverTrigger>
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
  const { deletePollMutation } = usePoll();
  const params = useParams() as { id: string };

  return (
    <AccordionItem value="poll">
      <AccordionTrigger>Gérer le sondage</AccordionTrigger>
      <AccordionContent>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="destructive">Supprimer le sondage</Button>
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
