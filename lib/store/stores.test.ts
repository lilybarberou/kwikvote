import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAlertStore } from "./alertStore";
import { useCommentsStore } from "./commentsStore";
import { useHistoryStore } from "./historyStore";
import { useLocalVotesStore } from "./localVotesStore";
import { useNotificationsStore } from "./notificationsStore";
import { useVotesStore } from "./votesStore";

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
  // zustand 5 reads window.localStorage
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });
  return items;
});
const stored = (key: string) => JSON.parse(storage.get(key)!).state;

beforeEach(() => {
  useLocalVotesStore.setState({ localVotes: {} });
  useHistoryStore.setState({ pollHistory: [] });
  useVotesStore.setState({ votes: {} });
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

describe("useHistoryStore", () => {
  const { addPollToHistory, removePollFromHistory } =
    useHistoryStore.getState();
  const history = () =>
    useHistoryStore.getState().pollHistory.map((poll) => poll.pollId);

  test("last consulted first, five at most", () => {
    for (const id of ["1", "2", "3", "4", "5", "6"])
      addPollToHistory(id, `Poll ${id}`);
    expect(history()).toEqual(["6", "5", "4", "3", "2"]);
    expect(stored("pollHistory").pollHistory).toHaveLength(5);
  });

  test("a poll consulted again goes first, with its new title, once", () => {
    addPollToHistory("1", "Old title");
    addPollToHistory("2", "Poll 2");
    addPollToHistory("1", "New title");
    expect(useHistoryStore.getState().pollHistory).toEqual([
      { pollId: "1", title: "New title" },
      { pollId: "2", title: "Poll 2" },
    ]);
  });

  test("removing a poll", () => {
    addPollToHistory("1", "Poll 1");
    addPollToHistory("2", "Poll 2");
    removePollFromHistory("1");
    expect(history()).toEqual(["2"]);
  });
});

describe("useVotesStore", () => {
  type Vote = Parameters<
    ReturnType<typeof useVotesStore.getState>["addVote"]
  >[0];
  const vote = (id: string, name: string) =>
    ({ id, name, subscriptionHashes: [], choices: [] }) as unknown as Vote;
  const names = () =>
    Object.values(useVotesStore.getState().votes).map((v) => v.name);

  test("init, add, update and remove", () => {
    const { initVotes, addVote, updateVote, removeVote } =
      useVotesStore.getState();
    initVotes([vote("a", "Alice"), vote("b", "Bob")]);
    expect(names()).toEqual(["Alice", "Bob"]);

    addVote(vote("c", "Carol"));
    updateVote(vote("a", "Alicia"));
    expect(names()).toEqual(["Alicia", "Bob", "Carol"]);

    // a vote deleted meanwhile is not added back by its update
    removeVote("b");
    updateVote(vote("b", "Bobby"));
    expect(names()).toEqual(["Alicia", "Carol"]);
  });
});

describe("the other stores", () => {
  test("comments, alerts and notifications", () => {
    const comment = (id: string) =>
      ({ id, author: "A", text: "Hi", pollId: "p" }) as never;
    useCommentsStore.getState().initComments([comment("1")]);
    useCommentsStore.getState().addComment(comment("2"));
    expect(
      useCommentsStore.getState().comments.map((c: { id: string }) => c.id),
    ).toEqual(["1", "2"]);

    useAlertStore.getState().updateAlert("pollLegend", true);
    expect(useAlertStore.getState().alerts).toEqual({ pollLegend: true });
    expect(stored("alerts").alerts).toEqual({ pollLegend: true });

    const subscription = { endpoint: "e", auth: "a", p256dh: "p" };
    useNotificationsStore.getState().init({
      notificationsSupported: true,
      notificationsPermission: "granted",
      subscription: null,
    });
    useNotificationsStore.getState().setSubscriptionEndpoint(subscription);
    expect(useNotificationsStore.getState()).toMatchObject({
      notificationsSupported: true,
      notificationsPermission: "granted",
      subscription,
    });
  });
});
