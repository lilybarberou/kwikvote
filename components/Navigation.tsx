import Link from 'next/link';
import { HelpCircle, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export default function Navigation() {
    return (
        <nav className="mb-10 flex justify-between">
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <Button asChild className="w-11 h-11" size="icon" variant="outline">
                            <Link href="/">
                                <Home className="w-5 h-5" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="hidden sm:block">Accueil</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex gap-2">
                <Button asChild className="h-11">
                    <Link href="/poll/create">Créer un sondage</Link>
                </Button>
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button asChild className="w-11 h-11" size="icon" variant="outline">
                                <Link href="/faq">
                                    <HelpCircle className="w-5 h-5" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="hidden sm:block">FAQ</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </nav>
    );
}
