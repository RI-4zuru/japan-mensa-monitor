import {
  CONFIG,
  STATUS,
  STATUS_LABEL
} from "./config.js";

import {
  parseExamPage
} from "./parser.js";

import {
  sendNtfy
} from "./notifier.js";


const STATE_KEY =
  "monitor_state_v1";

const HEALTH_KEY =
  "monitor_health_v1";


export async function runMonitor(
  env,
  options = {}
) {

  const now = Date.now();

  const [
    previousState,
    previousHealth
  ] = await Promise.all([

    getJson(
      env.MENSA_KV,
      STATE_KEY
    ),

    getJson(
      env.MENSA_KV,
      HEALTH_KEY
    ),
  ]);


  try {

    const html =
      await fetchExamPage();

    const parsed =
      parseExamPage(
        html,
        now
      );

    validateParsedPage(parsed);


    const currentState =
      buildState(
        parsed.events,
        previousState,
        now
      );


    const initialization =
      !previousState;


    const notifications =
      initialization
        ? []
        : createEventNotifications(
            previousState.events || [],
            parsed.events
          );


    for (const notice of notifications) {
      await sendNtfy(
        env,
        notice
      );
    }


    const issueSignature =
      parsed
        .unknownEvents
        .map(
          event => event.id
        )
        .sort()
        .join("|");


    const oldIssueSignature =
      previousHealth
        ?.parserIssueSignature || "";


    if (
      issueSignature &&
      issueSignature !==
        oldIssueSignature
    ) {

      await sendNtfy(
        env,
        {
          title:
            "⚠️ MENSA監視：判定できない枠があります",

          message:
            `${parsed.unknownEvents.length}件の試験枠で` +
            "状態を判定できませんでした。" +
            "サイト構造が変わった可能性があります。",

          priority: 4,

          tags: [
            "warning"
          ],

          click:
            CONFIG.sourceUrl,

          actionLabel:
            "MENSAページを確認",
        }
      );
    }


    const stateChanged =
      !previousState ||
      previousState.signature !==
        currentState.signature;


    if (stateChanged) {

      await env.MENSA_KV.put(
        STATE_KEY,
        JSON.stringify(
          currentState
        )
      );
    }


    const healthResult =
      await recordSuccess(
        env,
        previousHealth,
        now,
        issueSignature,
        initialization
      );


    return {
      ok: true,

      initialized:
        initialization,

      checkedAt:
        new Date(now)
          .toISOString(),

      parsedEvents:
        parsed.events.length,

      watchedEvents:
        parsed.events.filter(
          event =>
            event.watched
        ).length,

      notificationsSent:
        notifications.length,

      stateChanged,

      healthWritten:
        healthResult.written,

      manual:
        Boolean(
          options.manual
        ),
    };


  } catch (error) {

    const failure =
      await recordFailure(
        env,
        previousHealth,
        now,
        error
      );


    return {
      ok: false,

      checkedAt:
        new Date(now)
          .toISOString(),

      error:
        error instanceof Error
          ? error.message
          : String(error),

      failureCount:
        failure.failureCount,

      alertSent:
        failure.alertSent,

      manual:
        Boolean(
          options.manual
        ),
    };
  }
}


async function fetchExamPage() {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      CONFIG.requestTimeoutMs
    );

  try {

    const response =
      await fetch(
        CONFIG.sourceUrl,
        {
          headers: {
            Accept:
              "text/html,application/xhtml+xml",

            "User-Agent":
              CONFIG.userAgent,

            "Cache-Control":
              "no-cache",
          },

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );


    if (!response.ok) {

      throw new Error(
        "MENSA page returned HTTP " +
        response.status
      );
    }


    return await response.text();


  } finally {

    clearTimeout(timer);
  }
}


function validateParsedPage(parsed) {

  if (
    !parsed.hasExpectedHeading
  ) {

    throw new Error(
      "MENSA page heading was not found"
    );
  }


  if (
    parsed.hasDateTimeLabel &&
    parsed.parsedTotal === 0
  ) {

    throw new Error(
      "Exam date/time text exists, " +
      "but no exam cards could be parsed"
    );
  }
}


function buildState(
  events,
  previousState,
  now
) {

  const normalized =
    events.map(
      event => ({

        id:
          event.id,

        prefecture:
          event.prefecture,

        date:
          event.date,

        start:
          event.start,

        end:
          event.end,

        place:
          event.place,

        eligibilityText:
          event.eligibilityText,

        nationwide:
          event.nationwide,

        eligible:
          event.eligible,

        preferredVenue:
          event.preferredVenue,

        watched:
          event.watched,

        status:
          event.status,

        applicationUrl:
          event.applicationUrl,
      })
    );


  const signature =
    JSON.stringify(
      normalized
    );


  const previousSignature =
    previousState
      ?.signature || "";


  return {
    version: 1,

    signature,

    events:
      normalized,

    lastChangedAt:
      previousSignature ===
        signature &&
      previousState
        ?.lastChangedAt

        ? previousState
            .lastChangedAt

        : new Date(now)
            .toISOString(),
  };
}


function createEventNotifications(
  previousEvents,
  currentEvents
) {

  const previousMap =
    new Map(
      previousEvents.map(
        event => [
          event.id,
          event
        ]
      )
    );


  const notices = [];


  for (
    const current
    of currentEvents
  ) {

    if (!current.watched) {
      continue;
    }


    const previous =
      previousMap.get(
        current.id
      );


    if (!previous) {

      if (
        current.status ===
        STATUS.UNKNOWN
      ) {
        continue;
      }

      notices.push(
        newScheduleNotice(
          current
        )
      );

      continue;
    }


    if (
      previous.status !==
        STATUS.AVAILABLE &&

      current.status ===
        STATUS.AVAILABLE
    ) {

      notices.push(
        openSeatNotice(
          current,
          previous.status
        )
      );
    }
  }


  return notices;
}


function newScheduleNotice(event) {

  const available =
    event.status ===
      STATUS.AVAILABLE;


  const title =
    available

      ? "🆕🔥 JAPAN MENSA 新規日程・申込可能"

      : "🆕 JAPAN MENSA 新しい試験日程";


  return {
    title,

    message:
      formatEventMessage(
        event,

        available

          ? "現在、申込み可能です。"

          :
            `現在の状態：` +
            `${STATUS_LABEL[event.status]}`
      ),

    priority:
      available
        ? 5
        : event.status ===
            STATUS.FULL
          ? 4
          : 3,

    tags:
      available
        ? [
            "rotating_light",
            "new"
          ]
        : [
            "new"
          ],

    click:
      event.applicationUrl,

    actionLabel:
      available
        ? "今すぐ申し込む"
        : "日程を確認",
  };
}


function openSeatNotice(
  event,
  oldStatus
) {

  return {

    title:
      "🚨 JAPAN MENSA 空き発見！",

    message:
      formatEventMessage(
        event,

        `${STATUS_LABEL[oldStatus] || oldStatus}` +
        " → 申込可能 に変わりました。"
      ),

    priority: 5,

    tags: [
      "rotating_light"
    ],

    click:
      event.applicationUrl,

    actionLabel:
      "今すぐ申し込む",
  };
}


function formatEventMessage(
  event,
  extra
) {

  return [
    `${event.prefecture}　${event.date}`,

    `${event.start}～${event.end}`,

    event.place,

    event.nationwide
      ? "全国から申込可能"
      : event.eligibilityText,

    extra,

  ]
    .filter(Boolean)
    .join("\n");
}


async function recordSuccess(
  env,
  previousHealth,
  now,
  issueSignature,
  initialization
) {

  const previous =
    previousHealth || {};


  const bucket =
    Math.floor(
      now /
      (
        CONFIG.heartbeatMinutes *
        60 *
        1000
      )
    );


  const recovered =
    Boolean(
      previous.alerted
    );


  const issueChanged =
    (
      previous
        .parserIssueSignature || ""
    ) !==
    issueSignature;


  const needsHeartbeat =
    previous
      .heartbeatBucket !==
    bucket;


  const needsWrite =

    initialization ||

    recovered ||

    issueChanged ||

    needsHeartbeat ||

    (
      previous.failureCount ||
      0
    ) > 0;


  if (recovered) {

    await sendNtfy(
      env,
      {
        title:
          "✅ MENSA監視が復旧しました",

        message:
          "JAPAN MENSAの日程ページを" +
          "再び正常に取得できています。",

        priority: 3,

        tags: [
          "white_check_mark"
        ],

        click:
          CONFIG.sourceUrl,

        actionLabel:
          "MENSAページを確認",
      }
    );
  }


  if (!needsWrite) {

    return {
      written: false
    };
  }


  const next = {
    version: 1,

    failureCount: 0,

    alerted: false,

    lastError:
      previous.lastError || "",

    lastErrorAt:
      previous.lastErrorAt ||
      null,

    lastSuccessAt:
      new Date(now)
        .toISOString(),

    heartbeatBucket:
      bucket,

    parserIssueSignature:
      issueSignature,
  };


  await env.MENSA_KV.put(
    HEALTH_KEY,
    JSON.stringify(next)
  );


  return {
    written: true
  };
}


async function recordFailure(
  env,
  previousHealth,
  now,
  error
) {

  const previous =
    previousHealth || {};


  const oldCount =
    Number(
      previous.failureCount ||
      0
    );


  const nextCount =
    Math.min(
      CONFIG.failureThreshold,
      oldCount + 1
    );


  let alerted =
    Boolean(
      previous.alerted
    );


  let alertSent = false;


  if (
    nextCount >=
      CONFIG.failureThreshold &&

    !alerted
  ) {

    try {

      await sendNtfy(
        env,
        {
          title:
            "⚠️ JAPAN MENSA 監視異常",

          message:
            `${CONFIG.failureThreshold}回連続で` +
            "監視に失敗しました。\n" +
            safeError(error),

          priority: 4,

          tags: [
            "warning"
          ],

          click:
            CONFIG.sourceUrl,

          actionLabel:
            "MENSAページを確認",
        }
      );


      alerted = true;
      alertSent = true;


    } catch {

      alerted = false;
    }
  }


  const shouldWrite =

    oldCount <
      CONFIG.failureThreshold ||

    alertSent;


  if (shouldWrite) {

    const next = {
      version: 1,

      failureCount:
        nextCount,

      alerted,

      lastError:
        safeError(error),

      lastErrorAt:
        new Date(now)
          .toISOString(),

      lastSuccessAt:
        previous
          .lastSuccessAt ||
        null,

      heartbeatBucket:
        previous
          .heartbeatBucket ??
        null,

      parserIssueSignature:
        previous
          .parserIssueSignature ||
        "",
    };


    await env.MENSA_KV.put(
      HEALTH_KEY,
      JSON.stringify(next)
    );
  }


  return {
    failureCount:
      nextCount,

    alertSent
  };
}


function safeError(error) {

  const value =
    error instanceof Error
      ? error.message
      : String(error);

  return value.slice(
    0,
    300
  );
}


async function getJson(
  kv,
  key
) {

  const value =
    await kv.get(key);


  if (!value) {
    return null;
  }


  try {

    return JSON.parse(
      value
    );

  } catch {

    return null;
  }
}


export async function getMonitorData(
  env
) {

  const [
    state,
    health
  ] = await Promise.all([

    getJson(
      env.MENSA_KV,
      STATE_KEY
    ),

    getJson(
      env.MENSA_KV,
      HEALTH_KEY
    ),
  ]);


  return {
    state,
    health
  };
}
