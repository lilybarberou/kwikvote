"use client";

import { Copy } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";

export const DialogPollLink = () => {
  const [created, setCreated] = useQueryState(
    "created",
    parseAsBoolean.withDefault(false),
  );
  const { toast } = useToast();

  const copyPollLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href.split("?")[0]);
      toast({
        title: "Lien copié",
        description: "Vous pouvez maintenant partager votre sondage.",
      });
    } else {
      toast({
        title: "Woups, échec de la copie sur votre appareil",
        description:
          "Pas de panique ! Vous pouvez copier le lien manuellement en restant appuyé dessus (si vous êtes sur mobile).",
      });
    }
  };

  return (
    <AlertDialog defaultOpen={created}>
      <AlertDialogContent
        className="w-11/12 max-w-[350px]"
        onEscapeKeyDown={() => setCreated(null)}
      >
        <AlertDialogTitle>Sondage créé !</AlertDialogTitle>
        <AlertDialogDescription>
          <p className="mb-2">Conservez bien votre lien :</p>
          <div
            className="flex w-fit cursor-pointer items-center gap-2"
            onClick={copyPollLink}
          >
            <p className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap rounded border border-[#ffffff4d] px-2 py-1 md:max-w-[200px]">
              {window.location.href.split("?")[0]}
            </p>
            <Button
              className="hidden h-fit px-2 py-2 md:block"
              tabIndex={1}
              onClick={copyPollLink}
              variant="ghost"
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogAction
            autoFocus
            onClick={() => setCreated(null)}
            tabIndex={2}
          >
            Fermer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
