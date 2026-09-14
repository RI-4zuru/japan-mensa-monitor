import {
  CONFIG
} from "./config.js";

import {
  renderDashboard
} from "./dashboard.js";

import {
  getMonitorData,
  runMonitor
} from "./monitor.js";

import {
  sendNtfy
} from "./notifier.js";


export default {

  async scheduled(
    _controller,
    env,
    ctx
  ) {

    ctx.waitUntil(
      runMonitor(env)
    );
  },


  async fetch(
    request,
    env
  ) {

    const url =
      new URL(
        request.url
      );


    if (
      !isAuthorized(
        url,
        request,
        env
      )
    ) {

      return new Response(

        "管理キーが必要です。" +
        "Worker URL の末尾に " +
        "?key=あなたのADMIN_KEY " +
        "を付けて開いてください。",

        {
          status:401,

          headers:{
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        }
      );
    }


    if (
      url.pathname === "/"
    ) {

      const {
        state,
        health
      } =
        await getMonitorData(
          env
        );


      return new Response(

        renderDashboard(
          state,
          health
        ),

        {
          headers:{
            "Content-Type":
              "text/html; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    if (
      url.pathname ===
        "/api/check" &&

      request.method ===
        "POST"
    ) {

      const result =
        await runMonitor(
          env,
          {
            manual:true
          }
        );


      return json(
        result,
        result.ok
          ? 200
          : 500
      );
    }


    if (
      url.pathname ===
        "/api/test" &&

      request.method ===
        "POST"
    ) {

      try {

        await sendNtfy(
          env,
          {
            title:
              "🧪 JAPAN MENSA Monitor",

            message:
              "Push通知テストです。" +
              "通知システムは正常です。",

            priority:5,

            tags:[
              "test_tube"
            ],

            click:
              CONFIG.sourceUrl,

            actionLabel:
              "MENSA公式を開く",
          }
        );


        return json({
          ok:true,

          message:
            "テスト通知を送信しました"
        });


      } catch(error) {

        return json(
          {
            ok:false,

            error:
              error instanceof Error
                ? error.message
                : String(error)
          },
          500
        );
      }
    }


    if (
      url.pathname ===
        "/api/state"
    ) {

      const data =
        await getMonitorData(
          env
        );

      return json(data);
    }


    return new Response(
      "Not Found",
      {
        status:404
      }
    );
  },
};


function isAuthorized(
  url,
  request,
  env
) {

  if (!env.ADMIN_KEY) {
    return false;
  }


  const queryKey =
    url.searchParams
      .get("key") || "";


  const headerKey =
    request.headers
      .get("X-Admin-Key") ||
    "";


  return (
    queryKey ===
      env.ADMIN_KEY ||

    headerKey ===
      env.ADMIN_KEY
  );
}


function json(
  value,
  status = 200
) {

  return new Response(

    JSON.stringify(
      value,
      null,
      2
    ),

    {
      status,

      headers:{
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
