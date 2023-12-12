import Link from 'next/link';
import { useHistoryStore } from '@/lib/historyStore';

export default function ConsultedHistory() {
    const { pollHistory } = useHistoryStore();

    return (
        <div className="flex flex-col w-fit">
            {pollHistory.map((poll, index) => (
                <Link className={index !== pollHistory.length - 1 ? 'border-b' : ''} key={poll.pollId} href={`/poll/${poll.pollId}`}>
                    {poll.title}
                </Link>
            ))}
        </div>
    );
}
