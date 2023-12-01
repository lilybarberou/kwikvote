import { PollVote } from '@/app/api/poll/[pollKey]/[value]/route';
import { create } from 'zustand';

type Store = {
    votes: { [voteId: string]: PollVote };
    initVotes: (votes: PollVote[]) => void;
    addVote: (obj: PollVote) => void;
    updateVote: (obj: PollVote) => void;
    removeVote: (voteId: string) => void;
};

export const useVotesStore = create<Store>()((set, get) => ({
    votes: {},
    initVotes: (votes: PollVote[]) => {
        const newVotes: { [voteId: string]: PollVote } = {};
        votes.forEach((vote) => {
            newVotes[vote.id] = vote;
        });
        set({ votes: newVotes });
    },
    addVote: (obj: PollVote) => {
        set({ votes: { ...get().votes, [obj.id]: obj } });
    },
    updateVote: (obj: PollVote) => {
        if (get().votes.hasOwnProperty(obj.id)) {
            set({ votes: { ...get().votes, [obj.id]: obj } });
        }
    },
    removeVote: (voteId: string) => {
        const newVotes = { ...get().votes };
        delete newVotes[voteId];
        set({ votes: newVotes });
    },
}));
