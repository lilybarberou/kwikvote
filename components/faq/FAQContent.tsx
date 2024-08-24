import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bell, ShareIcon } from "lucide-react";

type Props = {
  faqPage?: boolean;
};

export const FAQContent = (props: Props) => {
  return (
    <Accordion className="w-full max-w-3xl" id="faq" type="single" collapsible>
      {props.faqPage && (
        <AccordionItem value="item-1">
          <AccordionTrigger>
            Comment recevoir les notifications ?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Pour recevoir les notifications sur un sondage, cliquez sur
              l'icône <Bell className="inline h-5 w-5" /> et acceptez les
              notifications ! Ensuite, inscrivez-vous sur un créneau, quelques
              soient vos choix.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
              (note: si vous avez désactivé les notifications de votre
              navigateur, vous ne pourrez pas les recevoir)
            </p>
            <br />
            <p className="underline">Spécification Iphone :</p>
            <p>
              Pour pouvoir activer les notifications sur Iphone (safari), vous
              devez tout d'abord installer l'application via l'icône{" "}
              <ShareIcon className="inline h-5 w-5" /> puis "sur l'écran
              d'accueil".
            </p>
          </AccordionContent>
        </AccordionItem>
      )}
      <AccordionItem value="item-2">
        <AccordionTrigger>
          Ai-je besoin d'un compte pour pouvoir utiliser KwikVote ?
        </AccordionTrigger>
        <AccordionContent>
          Non, il n'y a pas de compte sur KwikVote ! Pour les créateurs de
          sondage, vous êtes libre d'ajouter votre email ou non. Et pour les
          votes, il suffit de renseigner votre nom. 🙌
        </AccordionContent>
      </AccordionItem>
      {props.faqPage && (
        <AccordionItem value="item-3">
          <AccordionTrigger>
            À quoi sert l'email dans la création du sondage ?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Renseigner votre email dans les sondages va servir à deux choses :
            </p>
            <ul className="list-inside list-disc">
              <li>
                récupérer l'historique de vos sondages en cas de perte du lien
                📃
              </li>
              <li>
                (à venir) accéder à une page d'analyse de l'ensemble de vos
                sondages 📈
              </li>
            </ul>
            <p className="mt-2">
              Vous n'êtes donc pas forcés de le renseigner, mais dans ce cas,
              garde à ne pas perdre le lien !
            </p>
          </AccordionContent>
        </AccordionItem>
      )}
      <AccordionItem value="item-4">
        <AccordionTrigger>
          D'autres questions, des bugs, ou de nouvelles idées ?
        </AccordionTrigger>
        <AccordionContent>
          Contactez-moi via{" "}
          <a
            className="text-primary underline"
            href="mailto:lily.barberou@gmail.com"
          >
            lily.barberou@gmail.com
          </a>{" "}
          ✉️
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
