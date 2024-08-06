"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import { Controller } from "react-hook-form";

export const DatePicker = (props: any) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              {...field}
              variant={"outline"}
              className="w-[220px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {field.value ? (
                format(field.value, "PPP", { locale: fr })
              ) : (
                <span>Sélectionner une date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              lang="fr"
              locale={fr}
              selected={field.value}
              onSelect={(e) => {
                field.onChange(e);
                setOpen(false);
              }}
              mode="single"
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    />
  );
};
