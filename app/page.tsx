'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { HelpCircle, List, ListTodo } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import Footer from '@/components/Footer';
import FAQContent from '@/components/FAQContent';
import Link from 'next/link';
import ProcessSteps from '@/components/ProcessSteps';

const SearchSchema = z.object({
    email: z.string().email(),
});

export default function Home() {
    const router = useRouter();
    const { register, handleSubmit } = useForm<z.infer<typeof SearchSchema>>({
        resolver: zodResolver(SearchSchema),
    });

    const onSubmit = handleSubmit(({ email }) => {
        router.push(`/mes-sondages?email=${email}`);
    });

    return (
        <div className="w-full flex flex-col items-center">
            <div className="absolute -z-10 top-0 w-full h-screen" style={{ background: ' radial-gradient(88.74% 100% at 50% 0%, #41A4C3 0%, #020817 100%)' }} />
            <h1 className="mb-6 max-w-xl text-3xl font-semibold text-center sm:text-4xl">
                Créez un sondage en quelques secondes et partagez-le avec vos amis.
            </h1>
            <h2 className="mb-4 text-muted-foreground text-center">C&apos;est simple, gratuit, et aucun compte n&apos;est requis.</h2>
            <div className="mb-14 flex gap-2">
                <Button asChild variant="secondary">
                    <Link href="/poll/create">Créer mon sondage</Link>
                </Button>
                <Button asChild variant="outline" className="bg-transparent border-[#ffffff36] hover:bg-transparent" size="icon">
                    <Link href="#faq">
                        <HelpCircle className="w-5 h-5" />
                    </Link>
                </Button>
            </div>
            <Tabs defaultValue="free" className="mb-32 w-full flex flex-col items-center gap-4">
                <TabsList className="mb-2 bg-[#00000029]">
                    <TabsTrigger value="free" className="flex items-center gap-2 data-[state='active']:bg-[#ffffff28]">
                        <ListTodo className="w-5 h-5" />
                        Libre
                    </TabsTrigger>
                    <TabsTrigger value="waitlist" className="flex items-center gap-2 data-[state='active']:bg-[#ffffff28]">
                        <List className="w-5 h-5" />
                        Liste d&apos;attente
                    </TabsTrigger>
                </TabsList>
                <div className="p-2 w-full border border-[#ffffff38] border-b-0 rounded-lg aspect-auto sm:p-[10px]">
                    <div className="border border-[#ffffff38] border-b-0 rounded-sm">
                        <TabsContent value="free" className="mt-0">
                            <Image className="w-full h-full object-cover rounded-sm" width={1000} height={500} src="/poll-1.png" alt="Sondage libre" />
                        </TabsContent>
                        <TabsContent value="waitlist" className="mt-0">
                            <Image
                                className="w-full h-full object-cover rounded-sm"
                                width={1000}
                                height={500}
                                src="/poll-2.png"
                                alt="Sondage avec liste d'attente"
                            />
                        </TabsContent>
                    </div>
                </div>
            </Tabs>
            <ProcessSteps />
            <h3 className="mb-2 text-2xl font-semibold text-center sm:text-3xl">Vous avez déjà des sondages ?</h3>
            <p className="mb-8 text-muted-foreground text-center">
                Si vous avez lié vos sondages à votre adresse mail, vous pourrez en retrouver un historique.
            </p>
            <form onSubmit={onSubmit} className="mb-32 w-full flex justify-center items-end gap-2">
                <Input className="flex-1 sm:flex-initial sm:w-64" placeholder="Votre email..." {...register('email')} />
                <Button>Rechercher</Button>
            </form>
            <FAQContent />
            <Footer />
        </div>
    );
}
