import { CONFIG, STATUS } from "./config.js";

const BASE_URL = "https://mensa.jp";

const PREFECTURE_PATTERN =
  "(?:北海道|東京都|京都府|大阪府|[^\\n]{2,4}県)";

const EVENT_START_RE = new RegExp(
  `(?:^|\\n)\\s*(${PREFECTURE_PATTERN})\\s*\\n+\\s*\\d{1,2}\\/\\d{1,2}\\s*\\n+\\s*日時\\s*[：:]\\s*(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})(?:\\([^)]*\\))?\\s*(\\d{1,2}):(\\d{2})\\s*[~〜～-]\\s*(\\d{1,2}):(\\d{2})`,
  "g",
);

export function parseExamPage(html, nowMs = Date.now()) {
  const text = htmlToLinearText(html);

  const hasExpectedHeading =
    text.includes("入会テスト日程一覧");

  const hasDateTimeLabel =
    text.includes("日時");

  const matches = [
    ...text.matchAll(EVENT_START_RE)
  ];

  const today = jstDateString(nowMs);

  const allEvents = [];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const next = matches[i + 1];

    const block = text.slice(
      m.index,
      next ? next.index : text.length
    );

    const prefecture = cleanText(m[1]);

    const year = Number(m[2]);
    const month = Number(m[3]);
    const day = Number(m[4]);

    const startHour = Number(m[5]);
    const startMinute = Number(m[6]);

    const endHour = Number(m[7]);
    const endMinute = Number(m[8]);

    const date =
      `${year}-${pad(month)}-${pad(day)}`;

    const start =
      `${pad(startHour)}:${pad(startMinute)}`;

    const end =
      `${pad(endHour)}:${pad(endMinute)}`;

    const place =
      captureOne(
        block,
        /場所\s*[：:]\s*([^\n]+)/
      ) || prefecture;

    const eligibilityText =
      captureOne(
        block,
        /(このテストには、?[^\n。]+(?:。)?)/
      ) || "";

    const nationwide =
      eligibilityText.includes("全国");

    const eligible =
      nationwide ||
      eligibilityText.includes(
        CONFIG.residentPrefecture
      );

    const preferredVenue =
      CONFIG.preferredVenuePrefectures.includes(
        prefecture
      );

    const watched =
      preferredVenue ||
      (
        CONFIG.notifyEligibleOutsidePreferred &&
        eligible
      );

    const applicationUrl =
      extractApplicationUrl(block);

    let status = STATUS.UNKNOWN;

    if (block.includes("満員")) {
      status = STATUS.FULL;

    } else if (block.includes("締切")) {
      status = STATUS.CLOSED;

    } else if (applicationUrl) {
      status = STATUS.AVAILABLE;
    }

    allEvents.push({
      id:
        `${date}|${start}|${prefecture}|${place}`,

      prefecture,
      date,
      start,
      end,
      place,

      eligibilityText,
      nationwide,
      eligible,
      preferredVenue,
      watched,

      status,

      applicationUrl:
        applicationUrl || CONFIG.sourceUrl,
    });
  }

  const futureEvents =
    allEvents
      .filter(
        event => event.date >= today
      )
      .sort(
        (a, b) =>
          `${a.date}T${a.start}`
            .localeCompare(
              `${b.date}T${b.start}`
            )
      );

  return {
    text,
    hasExpectedHeading,
    hasDateTimeLabel,
    parsedTotal: allEvents.length,

    events: futureEvents,

    unknownEvents:
      futureEvents.filter(
        event =>
          event.status === STATUS.UNKNOWN
      ),
  };
}

function htmlToLinearText(html) {
  let s = String(html || "");

  s = s.replace(
    /<!--[\s\S]*?-->/g,
    " "
  );

  s = s.replace(
    /<script\b[\s\S]*?<\/script>/gi,
    " "
  );

  s = s.replace(
    /<style\b[\s\S]*?<\/style>/gi,
    " "
  );

  s = s.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (_, attrs, inner) => {

      const href =
        readAttribute(attrs, "href");

      const label =
        fragmentToText(inner);

      if (!href) {
        return ` ${label} `;
      }

      const absolute =
        absoluteUrl(
          decodeEntities(href)
        );

      return (
        `\n[[LINK:${absolute}]] ` +
        `${label} [[/LINK]]\n`
      );
    }
  );

  s = s.replace(
    /<img\b([^>]*)>/gi,
    (_, attrs) => {

      const alt =
        readAttribute(attrs, "alt") ||
        readAttribute(attrs, "title") ||
        "";

      return ` ${decodeEntities(alt)} `;
    }
  );

  s = s.replace(
    /<br\s*\/?>/gi,
    "\n"
  );

  s = s.replace(
    /<\/?(?:li|div|p|section|article|h[1-6]|tr|td|th|ul|ol|main|header|footer)[^>]*>/gi,
    "\n"
  );

  s = s.replace(
    /<[^>]+>/g,
    " "
  );

  s = decodeEntities(s);

  s = s.replace(/\r/g, "");

  s = s.replace(
    /[\t \u3000]+/g,
    " "
  );

  s = s.replace(
    / *\n */g,
    "\n"
  );

  s = s.replace(
    /\n{3,}/g,
    "\n\n"
  );

  return s.trim();
}

function fragmentToText(fragment) {
  let s = fragment;

  s = s.replace(
    /<img\b([^>]*)>/gi,
    (_, attrs) => {

      const alt =
        readAttribute(attrs, "alt") ||
        readAttribute(attrs, "title") ||
        "";

      return ` ${decodeEntities(alt)} `;
    }
  );

  s = s.replace(
    /<br\s*\/?>/gi,
    "\n"
  );

  s = s.replace(
    /<[^>]+>/g,
    " "
  );

  return cleanText(
    decodeEntities(s)
  );
}

function readAttribute(attrs, name) {
  const re =
    new RegExp(
      `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i"
    );

  const m =
    String(attrs || "").match(re);

  return m
    ? m[1] ?? m[2] ?? m[3] ?? ""
    : "";
}

function decodeEntities(value) {
  return String(value || "")

    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex) =>
        String.fromCodePoint(
          parseInt(hex, 16)
        )
    )

    .replace(
      /&#(\d+);/g,
      (_, dec) =>
        String.fromCodePoint(
          parseInt(dec, 10)
        )
    )

    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function absoluteUrl(href) {
  try {
    return new URL(
      href,
      BASE_URL
    ).toString();

  } catch {
    return href;
  }
}

function extractApplicationUrl(block) {

  const matches = [
    ...block.matchAll(
      /\[\[LINK:(https?:\/\/[^\]]+)\]\]/gi
    )
  ].map(m => m[1]);

  return (
    matches.find(
      url =>
        /\/exam\/index\/(?:notice|detail)\/id\/\d+\/?/i
          .test(url)
    ) || ""
  );
}

function captureOne(text, re) {
  const m = text.match(re);

  return m
    ? cleanText(m[1])
    : "";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function jstDateString(nowMs) {

  const d =
    new Date(
      nowMs +
      9 * 60 * 60 * 1000
    );

  return (
    `${d.getUTCFullYear()}-` +
    `${pad(d.getUTCMonth() + 1)}-` +
    `${pad(d.getUTCDate())}`
  );
}

function pad(n) {
  return String(n)
    .padStart(2, "0");
}
