import Link from 'next/link';
import { HelpCircle, Home, Link2 } from 'lucide-react';
import { Button } from './ui/button';

export default function Navigation() {
    return (
        <nav className="mb-10 flex justify-between">
            <Link href="/" legacyBehavior>
                <Button className="w-11 h-11" size="icon" variant="outline">
                    <Home className="w-5 h-5" />
                </Button>
            </Link>
            <div className="flex gap-2">
                <Link href="/poll/create" legacyBehavior>
                    <Button className="">Créer un sondage</Button>
                </Link>
                <Link href="/faq" legacyBehavior>
                    <Button className="w-11 h-11" size="icon" variant="outline">
                        <HelpCircle className="w-5 h-5" />
                    </Button>
                </Link>
            </div>
        </nav>
    );
}
