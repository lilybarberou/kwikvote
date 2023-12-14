import { Coffee } from 'lucide-react';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="mt-auto w-full">
            <div className="mt-20 py-2 border-t-[0.5px] border-t-[#ffffff21]">
                <div className="mx-auto px-4 max-w-6xl flex justify-between items-center">
                    <a
                        className="py-2 px-3 flex gap-2 items-center border border-[#3b82f6a3] rounded-md"
                        href="https://www.buymeacoffee.com/lilybarberou"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <p className="text-sm">Support</p>
                        <Coffee className="w-5 h-5" />
                    </a>
                    <div className="flex gap-2 items-center">
                        <p className="text-sm text-muted-foreground">
                            Créé par{' '}
                            <a className="font-semibold text-white" href="https:lilybarberou.fr" target="_blank" rel="noopener noreferrer">
                                Lily Barberou
                            </a>
                        </p>
                        <Image className="w-4" width={200} height={200} src="/sparkles.svg" alt="Fini" />
                    </div>
                </div>
            </div>
        </footer>
    );
}
