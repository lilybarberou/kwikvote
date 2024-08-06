import { Comment } from "@prisma/client";
import { create } from "zustand";

type Store = {
  comments: Comment[];
  addComment: (comment: Comment) => void;
  initComments: (comments: Comment[]) => void;
};

export const useCommentsStore = create<Store>((set) => ({
  comments: [],
  addComment: (comment) =>
    set((state) => ({
      comments: [...state.comments, comment],
    })),
  initComments: (comments) => set({ comments }),
}));
