'use client';

import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/utils/fetch';
import { CompletePoll } from './api/poll/id/[value]/route';
import dynamic from 'next/dynamic';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

const ConsultedHistory = dynamic(() => import('../components/ConsultedHistory'), {
    ssr: false,
});

const SearchSchema = z.object({
    email: z.string().email(),
});

export default function Home() {
    const { data: polls } = useSWR<CompletePoll[]>(`/api/poll`, fetcher);
    const router = useRouter();
    const { register, handleSubmit } = useForm<z.infer<typeof SearchSchema>>({
        resolver: zodResolver(SearchSchema),
    });

    const onSubmit = handleSubmit(({ email }) => {
        router.push(`/search?email=${email}`);
    });

    return (
        <div>
            <form onSubmit={onSubmit} className="mb-10 flex items-end gap-2">
                <div className="flex flex-col gap-3">
                    <Label htmlFor="email">Rechercher mes sondages</Label>
                    <Input placeholder="Email" id="email" {...register('email')} />
                </div>
                <Button>Rechercher</Button>
            </form>
            <ConsultedHistory />
            <div className="mt-10 flex flex-col w-fit">
                <p className="mb-2 text-3xl font-bold">Tout</p>
                {polls?.map((poll) => (
                    <Link key={poll.id} href={`/poll/${poll.id}`}>
                        {poll.title}
                    </Link>
                ))}
            </div>
        </div>
    );
}
