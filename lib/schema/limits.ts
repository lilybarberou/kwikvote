// The length limits of the schemas, apart from them: the forms only need
// these numbers, and importing a schema file brings zod into the page.

// vote form (components/poll/DialogVote.tsx), vote-schema.ts
export const VOTE_NAME_MAX_LENGTH = 100;

// comment form (components/poll/PollComments.tsx), comment-schema.ts
export const COMMENT_AUTHOR_MAX_LENGTH = 100;
export const COMMENT_TEXT_MAX_LENGTH = 5000;
