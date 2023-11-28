import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from './ui/button';

export default function Navigation() {
    return (
        <nav className="mb-10 flex justify-between">
            <Link href="/" legacyBehavior>
                <Button className="w-11 h-11" size="icon" variant="outline">
                    <Home className="w-5 h-5" />
                </Button>
            </Link>
            <Link href="/poll/create" legacyBehavior>
                <Button className="">Créer un sondage</Button>
            </Link>
        </nav>
    );
}
