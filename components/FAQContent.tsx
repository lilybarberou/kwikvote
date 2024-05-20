import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Bell } from 'lucide-react';

type Props = {
  faqPage?: boolean;
};

export default function FAQContent(props: Props) {
  return (
    <Accordion className="w-full max-w-3xl" id="faq" type="single" collapsible>
      {props.faqPage && (
        <AccordionItem value="item-1">
          <AccordionTrigger>Comment recevoir les notifications ?</AccordionTrigger>
          <AccordionContent>
            <p>
              Pour recevoir les notifications sur un sondage, vous devez avoir un vote de créé sur celui-ci, quelques soient les choix définis. Ensuite, cliquez
              sur l&apos;icône <Bell className="w-5 h-5 inline" /> et acceptez les notifications !
            </p>
            <p className="text-xs mt-1 text-gray-300">(note: si vous avez désactivé les notifications de votre navigateur, vous ne pourrez pas les recevoir)</p>
          </AccordionContent>
        </AccordionItem>
      )}
      <AccordionItem value="item-2">
        <AccordionTrigger>Ai-je besoin d&apos;un compte pour pouvoir utiliser KwikVote ?</AccordionTrigger>
        <AccordionContent>
          Non, il n&apos;y a pas de compte sur KwikVote ! Pour les créateurs de sondage, vous êtes libre d&apos;ajouter votre email ou non. Et pour les votes,
          il suffit de renseigner votre nom. 🙌
        </AccordionContent>
      </AccordionItem>
      {props.faqPage && (
        <AccordionItem value="item-3">
          <AccordionTrigger>À quoi sert l&apos;email dans la création du sondage ?</AccordionTrigger>
          <AccordionContent>
            <p>Renseigner votre email dans les sondages va servir à deux choses :</p>
            <ul className="list-disc list-inside">
              <li>récupérer l&apos;historique de vos sondages en cas de perte du lien 📃</li>
              <li>(à venir) accéder à une page d&apos;analyse de l&apos;ensemble de vos sondages 📈</li>
            </ul>
            <p className="mt-2">Vous n&apos;êtes donc pas forcés de le renseigner, mais dans ce cas, garde à ne pas perdre le lien !</p>
          </AccordionContent>
        </AccordionItem>
      )}
      <AccordionItem value="item-4">
        <AccordionTrigger>D&apos;autres questions, des bugs, ou de nouvelles idées ?</AccordionTrigger>
        <AccordionContent>
          Contactez-moi via{' '}
          <a className="text-primary underline" href="mailto:lily.barberou@gmail.com">
            lily.barberou@gmail.com
          </a>{' '}
          ✉️
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
