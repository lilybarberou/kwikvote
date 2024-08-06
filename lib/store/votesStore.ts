import { create } from "zustand";

import { PollVote } from "../api/poll/query";

type Store = {
  votes: { [voteId: string]: PollVote };
  initVotes: (votes: PollVote[]) => void;
  addVote: (obj: PollVote) => void;
  updateVote: (obj: PollVote) => void;
  removeVote: (voteId: string) => void;
};

export const useVotesStore = create<Store>()((set, get) => ({
  votes: {},
  initVotes: (votes) => {
    const newVotes: Store["votes"] = {};
    votes.forEach((vote) => {
      newVotes[vote.id] = vote;
    });
    set({ votes: newVotes });
  },
  addVote: (obj) => {
    set({ votes: { ...get().votes, [obj.id]: obj } });
  },
  updateVote: (obj) => {
    if (get().votes.hasOwnProperty(obj.id)) {
      set({ votes: { ...get().votes, [obj.id]: obj } });
    }
  },
  removeVote: (voteId) => {
    const newVotes = { ...get().votes };
    delete newVotes[voteId];
    set({ votes: newVotes });
  },
}));
