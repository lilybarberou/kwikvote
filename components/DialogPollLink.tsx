import { Copy } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from './ui/alert-dialog';

export default function DialogPollLink() {
    const searchParams = useSearchParams();
    const createdParam = searchParams.get('created');
    const router = useRouter();
    const { toast } = useToast();

    const copyPollLink = () => {
        navigator.clipboard.writeText(window.location.href.split('?')[0]);
        toast({ title: 'Lien copié', description: 'Vous pouvez maintenant partager votre sondage.' });
    };

    const removeQueryParams = () => router.push(window.location.href.split('?')[0]);

    return (
        <AlertDialog defaultOpen={createdParam === 'true'}>
            <AlertDialogContent className="w-11/12 max-w-[350px]">
                <AlertDialogTitle>Sondage créé !</AlertDialogTitle>
                <AlertDialogDescription>
                    <p className="mb-2">Conservez bien votre lien :</p>
                    <div className="w-fit flex gap-2 items-center cursor-pointer" onClick={copyPollLink}>
                        <p className="py-1 px-2 max-w-[200px] border border-[#ffffff4d] rounded text-ellipsis overflow-hidden whitespace-nowrap">
                            {window.location.href.split('?')[0]}
                        </p>
                        <Button className="px-2 h-6" tabIndex={1} onClick={copyPollLink} variant="ghost">
                            <Copy className="w-5 h-5" />
                        </Button>
                    </div>
                </AlertDialogDescription>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={removeQueryParams} tabIndex={2}>
                        Fermer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
