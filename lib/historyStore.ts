import { create } from "zustand";
import { persist } from "zustand/middleware";

type Store = {
  pollHistory: { pollId: string; title: string }[];
  addPollToHistory: (pollId: string, title: string) => void;
};

export const useHistoryStore = create<Store>()(
  persist(
    (set, get) => ({
      pollHistory: [],
      addPollToHistory: (pollId: string, title: string) => {
        // slice is for max 5 items
        if (get().pollHistory.find((poll) => poll.pollId === pollId)) {
          // put it at the beginning of the array
          set((state) => ({
            pollHistory: [
              { pollId, title },
              ...state.pollHistory.filter((poll) => poll.pollId !== pollId),
            ].slice(0, 5),
          }));
        } else {
          set((state) => ({
            pollHistory: [{ pollId, title }, ...state.pollHistory].slice(0, 5),
          }));
        }
      },
    }),
    {
      name: "pollHistory",
    },
  ),
);
