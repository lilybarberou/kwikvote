import { HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';

export default function RegistrationPollHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-11/12 max-w-[400px] leading-none">
        <p>Liste d'attente :</p>
        <p className="text-muted-foreground text-sm">Vous passez en inscrit dès qu'une place se libère.</p>
        <p>Liste d'attente réinscrits :</p>
        <p className="text-muted-foreground text-sm">
          Vous êtes déjà inscrit à un jour précédent. Vous passez en inscrit ou en liste d'attente une fois que l'heure limite choisie par l'auteur est
          atteinte.
        </p>
      </DialogContent>
    </Dialog>
  );
}
