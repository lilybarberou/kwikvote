import Link from 'next/link';
import { useHistoryStore } from '@/lib/historyStore';

export default function ConsultedHistory() {
    const { pollHistory } = useHistoryStore();

    return (
        <div className="flex flex-col w-fit">
            <h1 className="mb-2 text-3xl font-bold">Historique</h1>
            {pollHistory.map((poll) => (
                <Link key={poll.pollId} href={`/poll/${poll.pollId}`}>
                    {poll.title}
                </Link>
            ))}
        </div>
    );
}
