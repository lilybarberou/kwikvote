import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Store = {
    pollHistory: { pollId: string; title: string }[];
    addPollToHistory: (pollId: string, title: string) => void;
};

export const useHistoryStore = create<Store>()(
    persist(
        (set, get) => ({
            pollHistory: [],
            addPollToHistory: (pollId: string, title: string) => {
                if (get().pollHistory.find((poll) => poll.pollId === pollId)) {
                    // put it at the beginning of the array
                    set((state) => ({
                        pollHistory: [{ pollId, title }, ...state.pollHistory.filter((poll) => poll.pollId !== pollId)],
                    }));
                } else {
                    set((state) => ({
                        pollHistory: [{ pollId, title }, ...state.pollHistory],
                    }));
                }
            },
        }),
        {
            name: 'pollHistory',
        }
    )
);
