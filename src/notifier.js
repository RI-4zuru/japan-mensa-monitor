export async function sendNtfy(
  env,
  payload
) {

  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not configured"
    );
  }

  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error(
      "TELEGRAM_CHAT_ID is not configured"
    );
  }

  const apiUrl =
    "https://api.telegram.org/bot" +
    env.TELEGRAM_BOT_TOKEN +
    "/sendMessage";

  const text = [
    payload.title || "",
    "",
    payload.message || ""
  ]
    .filter(Boolean)
    .join("\n");

  const body = {
    chat_id:
      env.TELEGRAM_CHAT_ID,

    text,

    disable_notification:
      false
  };

  if (payload.click) {
    body.reply_markup = {
      inline_keyboard: [
        [
          {
            text:
              payload.actionLabel ||
              "開く",

            url:
              payload.click
          }
        ]
      ]
    };
  }

  const response =
    await fetch(
      apiUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(body)
      }
    );

  const result =
    await response
      .json()
      .catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(
      "Telegram error " +
      response.status +
      ": " +
      JSON.stringify(result)
    );
  }
}
