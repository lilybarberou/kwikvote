export const sendDiscordMessage = async ({
  title,
  description,
  fields,
}: {
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
}) => {
  await fetch(process.env.DISCORD_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [
        {
          title,
          description,
          fields,
        },
      ],
    }),
  });
};
