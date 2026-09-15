import {
  CONFIG,
  STATUS,
  STATUS_LABEL
} from "./config.js";

export function renderDashboard(
  state,
  health
) {

  const events =
    state?.events || [];

  const watched =
    events.filter(
      event =>
        event.watched
    );

  const available =
    watched.filter(
      event =>
        event.status ===
        STATUS.AVAILABLE
    );

  const heartbeat =
    health?.lastSuccessAt ||
    null;

  const stale =
    !heartbeat ||
    (
      Date.now() -
      new Date(
        heartbeat
      ).getTime()
    ) >
    15 * 60 * 1000;


  const statusText =
    health?.failureCount

      ? `連続失敗 ${health.failureCount} 回`

      : stale

        ? "heartbeatが古い"

        : "正常稼働中";


  const statusClass =
    health?.failureCount ||
    stale

      ? "bad"

      : "good";


  const rows =
    watched.map(
      event => `

<tr>

<td>
${e(event.date)}
</td>

<td>
${e(event.prefecture)}
</td>

<td>
${e(event.start)}
～
${e(event.end)}
</td>

<td>
${e(event.place)}
</td>

<td>
${
  event.nationwide
    ? "全国"
    : e(
        shortenEligibility(
          event.eligibilityText
        )
      )
}
</td>

<td>
<span class="pill ${statusCss(event.status)}">
${e(
  STATUS_LABEL[event.status] ||
  event.status
)}
</span>
</td>

<td>
<a
 href="${e(
   event.applicationUrl ||
   CONFIG.sourceUrl
 )}"
 target="_blank"
 rel="noopener"
>
開く
</a>
</td>

</tr>

`
    ).join("");


return `<!doctype html>

<html lang="ja">

<head>

<meta charset="utf-8">

<meta
 name="viewport"
 content="width=device-width,initial-scale=1"
>

<title>
JAPAN MENSA Monitor
</title>

<style>

:root {
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;

  color:#1c2430;
  background:#f4f6f8;
}

* {
  box-sizing:border-box;
}

body {
  margin:0;
}

.wrap {
  max-width:1180px;
  margin:0 auto;
  padding:20px;
}

.top {
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
}

.card {
  background:white;
  border:1px solid #dfe4ea;
  border-radius:16px;
  padding:18px;
  margin:14px 0;
  box-shadow:
    0 4px 18px
    rgba(0,0,0,.04);
}

h1 {
  font-size:24px;
  margin:0;
}

.badge {
  padding:7px 11px;
  border-radius:999px;
  font-weight:700;
}

.good {
  background:#e8f7ee;
  color:#116530;
}

.bad {
  background:#fff0f0;
  color:#a12622;
}

.stats {
  display:grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(160px,1fr)
    );

  gap:10px;
}

.stat {
  background:#f7f9fb;
  border-radius:12px;
  padding:12px;
}

.num {
  font-size:24px;
  font-weight:800;
}

.muted {
  color:#667085;
  font-size:13px;
}

.buttons {
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

button,
a.btn {

  border:0;
  border-radius:10px;

  padding:
    10px 14px;

  font-weight:700;

  cursor:pointer;

  text-decoration:none;

  background:#172033;
  color:#fff;
}

button.secondary {
  background:#e8edf3;
  color:#172033;
}

table {
  width:100%;
  border-collapse:collapse;
  font-size:14px;
}

th,
td {
  padding:10px;

  border-bottom:
    1px solid #e8ebef;

  text-align:left;
  vertical-align:top;
}

th {
  white-space:nowrap;
}

.table-wrap {
  overflow:auto;
}

.pill {
  display:inline-block;
  padding:4px 8px;
  border-radius:999px;
  font-weight:700;
  white-space:nowrap;
}

.s-available {
  background:#ffe8e8;
  color:#b42318;
}

.s-full {
  background:#eef1f4;
  color:#475467;
}

.s-closed {
  background:#f4f0ff;
  color:#6941c6;
}

.s-unknown {
  background:#fff6df;
  color:#8a6116;
}

#result {
  white-space:pre-wrap;
  font-family:
    ui-monospace,
    monospace;

  font-size:12px;
}

</style>

</head>

<body>

<div class="wrap">

<div class="top">

<h1>
🧠 JAPAN MENSA Monitor
</h1>

<span
 class="badge ${statusClass}"
>
${e(statusText)}
</span>

</div>


<div class="card stats">

<div class="stat">

<div class="muted">
監視間隔
</div>

<div class="num">
1分
</div>

</div>


<div class="stat">

<div class="muted">
通知対象の今後の日程
</div>

<div class="num">
${watched.length}
</div>

</div>


<div class="stat">

<div class="muted">
現在申込可能
</div>

<div class="num">
${available.length}
</div>

</div>


<div class="stat">

<div class="muted">
heartbeat
</div>

<div>
${e(
  formatJst(
    heartbeat
  )
)}
</div>

</div>

</div>


<div class="card">

<div class="buttons">

<button id="check">
今すぐ確認
</button>

<button
 id="test"
 class="secondary"
>
テスト通知
</button>

<a
 class="btn"
 href="${e(CONFIG.sourceUrl)}"
 target="_blank"
 rel="noopener"
>
MENSA公式を開く
</a>

</div>

<p class="muted">
heartbeatは無料枠節約のため
約5分ごとに保存します。
監視処理そのものは毎分実行します。
</p>

<div id="result"></div>

</div>


<div class="card">

<h2>
監視対象
</h2>

<div class="table-wrap">

<table>

<thead>

<tr>

<th>日付</th>
<th>会場</th>
<th>時間</th>
<th>場所</th>
<th>申込地域</th>
<th>状態</th>
<th></th>

</tr>

</thead>

<tbody>

${
  rows ||
  `
<tr>
<td colspan="7">
現在、監視対象の日程はありません。
</td>
</tr>
`
}

</tbody>

</table>

</div>

</div>


<div class="card muted">

<div>
最終状態変化:
${e(
  formatJst(
    state?.lastChangedAt
  )
)}
</div>

<div>
最終エラー:
${e(
  health?.lastError ||
  "なし"
)}
</div>

<div>
最終エラー時刻:
${e(
  formatJst(
    health?.lastErrorAt
  )
)}
</div>

</div>

</div>


<script>

const key =
  new URLSearchParams(
    location.search
  ).get('key') || '';


async function callApi(path) {

  const out =
    document.getElementById(
      'result'
    );

  out.textContent =
    '実行中…';


  try {

    const r =
      await fetch(
        path +
        '?key=' +
        encodeURIComponent(key),
        {
          method:'POST'
        }
      );


    const t =
      await r.text();


    out.textContent =
      t;


    if (
      r.ok &&
      path === '/api/check'
    ) {

      setTimeout(
        () =>
          location.reload(),
        800
      );
    }


  } catch(err) {

    out.textContent =
      String(err);
  }
}


document
  .getElementById('check')
  .onclick =
    () =>
      callApi('/api/check');


document
  .getElementById('test')
  .onclick =
    () =>
      callApi('/api/test');

</script>

</body>

</html>`;
}


function statusCss(status) {

  if (
    status ===
      STATUS.AVAILABLE
  ) {
    return "s-available";
  }

  if (
    status ===
      STATUS.FULL
  ) {
    return "s-full";
  }

  if (
    status ===
      STATUS.CLOSED
  ) {
    return "s-closed";
  }

  return "s-unknown";
}


function shortenEligibility(text) {

  return String(text || "")

    .replace(
      /^このテストには、?/,
      ""
    )

    .replace(
      /在住の方が申し込めます。?$/,
      ""
    );
}


function formatJst(value) {

  if (!value) {
    return "未記録";
  }


  try {

    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      }
    ).format(
      new Date(value)
    );


  } catch {

    return String(value);
  }
}


function e(value) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#39;"
    );
}
