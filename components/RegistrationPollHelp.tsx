import { HelpCircle } from "lucide-react";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

export default function RegistrationPollHelp() {
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
          Vous êtes déjà inscrit à un jour précédent. Vous passez en inscrit ou
          en liste d'attente une fois que l'heure limite choisie par l'auteur
          est atteinte.
        </p>
      </DialogContent>
    </Dialog>
  );
}
