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
                        className={`relative py-2 px-3 text-ellipsis overflow-hidden ${
                            index === pollHistory.length - 1
                                ? ''
                                : 'after:absolute after:bottom-0 after:left-3 after:h-1 after:w-[calc(100%-24px)] after:border-b after:border-[#ffffff29]'
                        }`}
                        href={`/poll/${poll.pollId}`}
                    >
                        {poll.title}
                    </Link>
                </PopoverClose>
            ))}
        </div>
    );
}
