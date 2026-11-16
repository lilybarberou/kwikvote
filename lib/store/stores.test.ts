import { beforeEach, describe, expect, test, vi } from "vitest";

import { useLocalVotesStore } from "./localVotesStore";

// the persisted stores write to the browser storage
const storage = vi.hoisted(() => {
  const items = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
  });
  return items;
});
const stored = (key: string) => JSON.parse(storage.get(key)!).state;

beforeEach(() => {
  useLocalVotesStore.setState({ localVotes: {} });
});

describe("useLocalVotesStore", () => {
  const { addLocalVote, removeLocalVote } = useLocalVotesStore.getState();
  const votes = () => useLocalVotesStore.getState().localVotes;

  test("the votes made on this browser, by poll", () => {
    addLocalVote("poll-1", "a");
    addLocalVote("poll-1", "b");
    addLocalVote("poll-2", "c");
    expect(votes()).toEqual({ "poll-1": ["a", "b"], "poll-2": ["c"] });
    expect(stored("local-votes").localVotes).toEqual(votes());
  });

  test("an edit doesn't add the vote again", () => {
    addLocalVote("poll-1", "a");
    const before = votes();
    addLocalVote("poll-1", "a");
    expect(votes()).toBe(before);
    expect(votes()).toEqual({ "poll-1": ["a"] });
  });

  test("removing the last vote of a poll removes the poll", () => {
    addLocalVote("poll-1", "a");
    addLocalVote("poll-1", "b");
    removeLocalVote("poll-1", "a");
    expect(votes()).toEqual({ "poll-1": ["b"] });
    removeLocalVote("poll-1", "b");
    expect(votes()).toEqual({});
    // unknown poll or vote: nothing changes
    removeLocalVote("poll-3", "x");
    expect(votes()).toEqual({});
  });
});
