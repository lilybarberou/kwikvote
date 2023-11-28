import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from './ui/button';

export default function Navigation() {
    return (
        <nav className="flex">
            <Link href="/" legacyBehavior>
                <Button className="mb-10 w-11 h-11" size="icon" variant="outline">
                    <Home className="w-5 h-5" />
                </Button>
            </Link>
        </nav>
    );
}
