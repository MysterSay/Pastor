export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/profiles") {
      return new Response(
        JSON.stringify({
          ok: true,
          route: "/api/profiles works",
          hasToken: Boolean(env.NOTION_TOKEN),
          hasDataSourceId: Boolean(env.NOTION_DATA_SOURCE_ID),
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return env.ASSETS.fetch(request);
  },
};