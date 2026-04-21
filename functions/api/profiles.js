export async function onRequestGet(context) {
  return new Response(
    JSON.stringify({
      ok: true,
      route: "/api/profiles works",
      hasToken: Boolean(context.env.NOTION_TOKEN),
      hasDataSourceId: Boolean(context.env.NOTION_DATA_SOURCE_ID),
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}
