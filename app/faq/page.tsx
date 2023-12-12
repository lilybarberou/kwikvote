import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQ({ displayTitle = true }: { displayTitle?: boolean }) {
    return (
        <div className="m-auto w-full max-w-3xl">
            {displayTitle && <h1 className="mb-5 text-3xl font-bold">FAQ</h1>}
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Comment recevoir les notifications ?</AccordionTrigger>
                    <AccordionContent>À venir...</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Ai-je besoin d&apos;un compte pour pouvoir utiliser KwikVote ?</AccordionTrigger>
                    <AccordionContent>
                        Non, il n&apos;y a pas de compte sur KwikVote ! Pour les créateurs de sondage, vous êtes libre d&apos;ajouter votre email ou non. Et
                        pour les votes, il suffit de renseigner votre nom. 🙌
                    </AccordionContent>
                </AccordionItem>
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
                <AccordionItem value="item-4">
                    <AccordionTrigger>D&apos;autres questions, des bugs, ou de nouvelles idées ?</AccordionTrigger>
                    <AccordionContent>
                        Contactez-moi à{' '}
                        <a className="text-primary underline" href="mailto:lily.barberou@gmail.com">
                            lily.barberou@gmail.com
                        </a>{' '}
                        ✉️
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
