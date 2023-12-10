import Link from 'next/link';
import { HelpCircle, Home, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export default function Navigation() {
    return (
        <nav className="mb-10 flex justify-between">
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <Link href="/" legacyBehavior>
                        <TooltipTrigger asChild>
                            <Button className="w-11 h-11" size="icon" variant="outline">
                                <Home className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                    </Link>
                    <TooltipContent className="hidden sm:block">Accueil</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex gap-2">
                <Link href="/poll/create" legacyBehavior>
                    <Button className="h-11">Créer un sondage</Button>
                </Link>
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <Link href="/faq" legacyBehavior>
                            <TooltipTrigger asChild>
                                <Button className="w-11 h-11" size="icon" variant="outline">
                                    <HelpCircle className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                        </Link>
                        <TooltipContent className="hidden sm:block">FAQ</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                {/* <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <Link href="/changelog" legacyBehavior>
                            <TooltipTrigger asChild>
                                <Button className="w-11 h-11" size="icon" variant="outline">
                                    <Sparkles className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                        </Link>
                        <TooltipContent>Changelog</TooltipContent>
                    </Tooltip>
                </TooltipProvider> */}
            </div>
        </nav>
    );
}
