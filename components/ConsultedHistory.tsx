import Link from 'next/link';
import { useHistoryStore } from '@/lib/historyStore';
import { PopoverClose } from '@radix-ui/react-popover';

export default function ConsultedHistory() {
    const { pollHistory } = useHistoryStore();

    return (
        <div className="w-full min-w-[200px] flex flex-col gap-1">
            {pollHistory.map((poll, index) => (
                <PopoverClose key={poll.pollId} asChild>
                    <Link
                        className={`py-2 px-3 text-ellipsis overflow-hidden ${index === pollHistory.length - 1 ? '' : 'border-b border-[#ffffff29]'}`}
                        href={`/poll/${poll.pollId}`}
                    >
                        {poll.title}
                    </Link>
                </PopoverClose>
            ))}
        </div>
    );
}
