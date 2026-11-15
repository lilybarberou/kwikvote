import { HelpCircle, Star } from "lucide-react";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";

export const RegistrationPollHelp = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-11/12 max-w-[400px] leading-none">
        <p>Liste d'attente :</p>
        <p className="text-sm text-muted-foreground">
          Vous passez en inscrit dès qu'une place se libère.
        </p>
        <p>Liste d'attente réinscrits :</p>
        <p className="text-sm text-muted-foreground">
          Vous êtes déjà inscrit sur un autre créneau (un jour précédent, ou un
          créneau que vous avez marqué prioritaire). Vous passez en inscrit ou
          en liste d'attente une fois que l'heure limite choisie par l'auteur
          est atteinte.
        </p>
        <p className="flex items-center gap-1">
          <Star
            aria-hidden
            className="h-4 w-4 fill-amber-400 stroke-amber-500"
          />
          Créneau prioritaire :
        </p>
        <p className="text-sm text-muted-foreground">
          Avant l'heure limite, vous n'êtes inscrit que sur un créneau : par
          défaut le premier qui a de la place. Vos créneaux prioritaires passent
          avant les autres. S'ils sont complets, vous gardez votre place
          ailleurs et attendez à la suite de la liste d'attente.
        </p>
      </DialogContent>
    </Dialog>
  );
};
