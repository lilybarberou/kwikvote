import { SignpostBig } from 'lucide-react';
import Link from 'next/link';

export default function PageNotFound() {
    return (
        <div className="mx-auto mt-24 flex flex-col justify-center items-center">
            <SignpostBig className="mb-10 w-24 h-24" />
            <p className="text-2xl font-bold">Vous êtes perdu.</p>
            <p className="text-muted-foreground text-center">
                Venez par{' '}
                <Link className="text-primary" href="/">
                    ici
                </Link>
                .
            </p>
        </div>
    );
}
