export const CONFIG = {
  sourceUrl: "https://mensa.jp/exam/",

  residentPrefecture: "大阪府",

  preferredVenuePrefectures: [
    "大阪府",
    "京都府",
    "兵庫県",
    "滋賀県",
    "奈良県",
    "和歌山県",
  ],

  notifyEligibleOutsidePreferred: true,

  heartbeatMinutes: 5,

  failureThreshold: 5,

  requestTimeoutMs: 15000,

  userAgent: "JapanMensaAvailabilityMonitor/1.0",
};

export const STATUS = {
  AVAILABLE: "AVAILABLE",
  FULL: "FULL",
  CLOSED: "CLOSED",
  UNKNOWN: "UNKNOWN",
};

export const STATUS_LABEL = {
  AVAILABLE: "申込可能",
  FULL: "満員",
  CLOSED: "締切",
  UNKNOWN: "不明",
};
