export async function sendNtfy(
  env,
  payload
) {

  if (!env.NTFY_TOPIC) {
    throw new Error(
      "NTFY_TOPIC secret is not configured"
    );
  }

  const headers = {
    "Content-Type":
      "application/json; charset=utf-8",
  };

  if (env.NTFY_TOKEN) {
    headers.Authorization =
      `Bearer ${env.NTFY_TOKEN}`;
  }

  const body = {
    topic: env.NTFY_TOPIC,

    title: payload.title,

    message: payload.message,

    priority:
      payload.priority ?? 3,

    tags:
      payload.tags ?? [],

    click:
      payload.click,
  };

  if (payload.click) {

    body.actions = [
      {
        action: "view",

        label:
          payload.actionLabel || "開く",

        url:
          payload.click,

        clear: true,
      },
    ];
  }

  const response =
    await fetch(
      "https://ntfy.sh",
      {
        method: "POST",

        headers,

        body:
          JSON.stringify(body),
      }
    );

  if (!response.ok) {

    const detail =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `ntfy error ${response.status}: ` +
      detail.slice(0, 200)
    );
  }
}
