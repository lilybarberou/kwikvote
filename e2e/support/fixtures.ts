import { Browser, BrowserContext, Page, test as base } from "@playwright/test";

import { installPushMock } from "./browser-mocks";
import { FakePushSubscription, createFakePushSubscription } from "./push";

export type Participant = {
  context: BrowserContext;
  page: Page;
  // only with { notifications: true }
  push?: FakePushSubscription;
};

// the analytics script of the layout: never reach the real umami
const blockExternalRequests = async (context: BrowserContext) => {
  await context.route(/umami\.lilybarberou\.fr/, (route) => route.abort());
};

const newParticipant = async (
  browser: Browser,
  options: { notifications?: boolean },
): Promise<Participant> => {
  // a context per participant: its own local storage, so its own votes
  const context = await browser.newContext();
  await blockExternalRequests(context);
  let push: FakePushSubscription | undefined;
  if (options.notifications) {
    push = createFakePushSubscription();
    await context.addInitScript(installPushMock, {
      endpoint: push.endpoint,
      keys: push.keys,
    });
  }
  const page = await context.newPage();
  return { context, page, push };
};

export const test = base.extend<{
  // more participants, each in a browser context of their own
  participant: (options?: { notifications?: boolean }) => Promise<Participant>;
}>({
  context: async ({ context }, use) => {
    await blockExternalRequests(context);
    await use(context);
  },
  participant: async ({ browser }, use) => {
    const participants: Participant[] = [];
    await use(async (options = {}) => {
      const participant = await newParticipant(browser, options);
      participants.push(participant);
      return participant;
    });
    await Promise.all(participants.map(({ context }) => context.close()));
  },
});

export { expect } from "@playwright/test";
