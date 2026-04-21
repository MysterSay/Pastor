/**
 * Приклад serverless-проксі на JS.
 * Підходить як основа для Cloudflare Worker / Netlify Function / Vercel Edge Function.
 * GitHub Pages НЕ може безпечно зберігати runtime-секрети, тому прямий виклик Notion API з браузера — погана ідея.
 */

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/api/profiles") {
      return new Response("Not found", { status: 404 });
    }

    const notionToken = env.NOTION_TOKEN;
    const dataSourceId = env.NOTION_DATA_SOURCE_ID;

    if (!notionToken || !dataSourceId) {
      return json({ error: "Missing NOTION_TOKEN or NOTION_DATA_SOURCE_ID" }, 500);
    }

    const pages = await queryAllPages({ notionToken, dataSourceId });
    const items = pages
      .map(normalizeNotionPage)
      .filter((item) => item.isReady)
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    return json({ items }, 200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    });
  },
};

const FIELD_MAP = {
  NAME: "Name:",
  AGE: "Age:",
  MARITAL_STATUS: "Marital Status:",
  PLACE_OF_MINISTRY: "Place of Ministry:",
  CHURCH: "Church:",
  POSITION: "Position:",
  NOTE: "Note:",
  TEXT: "Text:",
  PHOTO: "Фото",
};

async function queryAllPages({ notionToken, dataSourceId }) {
  const results = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const response = await fetch(`https://api.notion.com/v1/data-sources/${dataSourceId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03",
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: nextCursor,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    results.push(...(data.results || []));
    hasMore = Boolean(data.has_more);
    nextCursor = data.next_cursor;
  }

  return results;
}

function normalizeNotionPage(page) {
  const properties = page.properties || {};
  const position = getPropertyText(properties[FIELD_MAP.POSITION]);

  return {
    id: page.id,
    name: getPropertyText(properties[FIELD_MAP.NAME]) || "Без імені",
    age: getPropertyText(properties[FIELD_MAP.AGE]) || "—",
    maritalStatus: getPropertyText(properties[FIELD_MAP.MARITAL_STATUS]) || "Не вказано",
    placeOfMinistry: getPropertyText(properties[FIELD_MAP.PLACE_OF_MINISTRY]) || "Не вказано",
    church: getPropertyText(properties[FIELD_MAP.CHURCH]) || "Не вказано",
    position,
    note: getPropertyText(properties[FIELD_MAP.NOTE]) || "",
    text: getPropertyText(properties[FIELD_MAP.TEXT]) || "",
    photo: getPropertyFile(properties[FIELD_MAP.PHOTO]) || "",
    createdTime: page.created_time,
    isReady: position.trim().toLowerCase() === "готово",
  };
}

function getPropertyText(property) {
  if (!property) return "";
  switch (property.type) {
    case "title":
      return property.title.map((item) => item.plain_text).join("").trim();
    case "rich_text":
      return property.rich_text.map((item) => item.plain_text).join("").trim();
    case "number":
      return property.number != null ? String(property.number) : "";
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "multi_select":
      return property.multi_select?.map((item) => item.name).join(", ") || "";
    case "formula":
      return getFormulaText(property.formula);
    default:
      return "";
  }
}

function getFormulaText(formula) {
  if (!formula) return "";
  if (formula.type === "string") return formula.string || "";
  if (formula.type === "number") return formula.number != null ? String(formula.number) : "";
  if (formula.type === "boolean") return formula.boolean ? "Так" : "Ні";
  if (formula.type === "date") return formula.date?.start || "";
  return "";
}

function getPropertyFile(property) {
  if (!property || property.type !== "files" || !property.files?.length) return "";
  const file = property.files[0];
  if (file.type === "external") return file.external?.url || "";
  if (file.type === "file") return file.file?.url || "";
  return "";
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
