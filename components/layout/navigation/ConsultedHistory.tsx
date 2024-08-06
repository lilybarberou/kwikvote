import { useHistoryStore } from "@/lib/store/historyStore";
import { PopoverClose } from "@radix-ui/react-popover";
import Link from "next/link";

export const ConsultedHistory = () => {
  const { pollHistory } = useHistoryStore();

  if (!pollHistory.length)
    return (
      <div className="flex w-full min-w-[200px] flex-col bg-popover">
        <span className="overflow-hidden text-ellipsis px-3 py-2 text-sm">
          Aucun sondage consulté pour le moment.
        </span>
      </div>
    );
  return (
    <div className="flex w-full min-w-[200px] flex-col bg-popover dark:bg-transparent rounded">
      {pollHistory.map((poll, index) => (
        <PopoverClose key={poll.pollId} asChild>
          <Link
            className={`relative overflow-hidden text-ellipsis px-3 py-2 text-sm ${
              index === pollHistory.length - 1
                ? ""
                : "after:absolute after:bottom-0 after:left-3 after:h-1 after:w-[calc(100%-24px)] after:border-b dark:after:border-[#ffffff29] after:border-[#41414121]"
            }`}
            href={`/poll/${poll.pollId}`}
          >
            {poll.title}
          </Link>
        </PopoverClose>
      ))}
    </div>
  );
};
