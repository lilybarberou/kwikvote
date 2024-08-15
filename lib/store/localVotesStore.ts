import { create } from "zustand";
import { persist } from "zustand/middleware";

type Store = {
  localVotes: Record<string, string[]>;
  addLocalVote: (pollId: string, voteId: string) => void;
  removeLocalVote: (pollId: string, voteId: string) => void;
};

export const useLocalVotesStore = create<Store>()(
  persist(
    (set, get) => ({
      localVotes: {},
      addLocalVote: (pollId, voteId) => {
        set((state) => {
          const votes = state.localVotes[pollId] || [];
          return {
            localVotes: {
              ...state.localVotes,
              [pollId]: [...votes, voteId],
            },
          };
        });
      },
      removeLocalVote: (pollId, voteId) => {
        set((state) => {
          const votes = state.localVotes[pollId] || [];
          const newVotes = votes.filter((id) => id !== voteId);

          const newLocalVotes = { ...state.localVotes };
          if (newVotes.length) {
            newLocalVotes[pollId] = newVotes;
          } else {
            delete newLocalVotes[pollId];
          }

          return { localVotes: newLocalVotes };
        });
      },
    }),
    { name: "local-votes" },
  ),
);
