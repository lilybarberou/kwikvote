import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQ() {
    return (
        <div>
            <h1 className="mb-5 text-3xl font-bold">FAQ</h1>
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Comment recevoir les notifications ?</AccordionTrigger>
                    <AccordionContent>xxx</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>D&apos;autres questions ?</AccordionTrigger>
                    <AccordionContent>Contactez-moi pour que j&apos;y réponde ✉️</AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
