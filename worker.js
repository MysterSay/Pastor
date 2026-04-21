const NOTION_VERSION = "2025-09-03";

const NOTION_FIELD_MAP = {
  DISPLAY_NAME: "Name:",
  TITLE_NAME: "Name",
  AGE: "Age:",
  MARITAL_STATUS: "Marital Status:",
  PLACE_OF_MINISTRY: "Place of Ministry:",
  CHURCH: "Church:",
  ROLE: "Position:",
  PUBLISH_STATUS: "Позиція",
  NOTE: "Note:",
  TEXT: "Text:",
  PHOTO: "Фото",
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/profiles") {
        return await handleProfiles(env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json(
        {
          ok: false,
          error: error?.message || "Невідома помилка Worker",
        },
        500
      );
    }
  },
};

async function handleProfiles(env) {
  const NOTION_TOKEN = env.NOTION_TOKEN;
  const NOTION_DATA_SOURCE_ID = env.NOTION_DATA_SOURCE_ID;

  if (!NOTION_TOKEN) {
    return json({ ok: false, error: "Не задано секрет NOTION_TOKEN у Cloudflare Worker." }, 500);
  }

  if (!NOTION_DATA_SOURCE_ID) {
    return json({ ok: false, error: "Не задано секрет NOTION_DATA_SOURCE_ID у Cloudflare Worker." }, 500);
  }

  const pages = await queryAllPages({
    token: NOTION_TOKEN,
    dataSourceId: NOTION_DATA_SOURCE_ID,
  });

  const items = pages
    .map(normalizeNotionPage)
    .filter((item) => item.isReady)
    .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

  return json({ ok: true, items });
}

async function queryAllPages({ token, dataSourceId }) {
  const results = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          ...(nextCursor ? { start_cursor: nextCursor } : {}),
        }),
      }
    );

    const responseText = await response.text();

    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(`Notion повернув некоректний JSON. HTTP ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(
        `Notion API ${response.status}: ${data?.message || data?.error || "unknown error"}`
      );
    }

    results.push(...(data.results || []));
    hasMore = Boolean(data.has_more);
    nextCursor = data.next_cursor || undefined;
  }

  return results;
}

function normalizeNotionPage(page) {
  const properties = page?.properties || {};

  const publishStatus = getPropertyText(
    properties[NOTION_FIELD_MAP.PUBLISH_STATUS]
  ).trim();

  const displayName =
    getPropertyText(properties[NOTION_FIELD_MAP.DISPLAY_NAME]) ||
    getPropertyText(properties[NOTION_FIELD_MAP.TITLE_NAME]) ||
    "Без імені";

  return {
    id: page?.id || crypto.randomUUID(),
    name: displayName,
    age: getPropertyText(properties[NOTION_FIELD_MAP.AGE]) || "—",
    maritalStatus:
      getPropertyText(properties[NOTION_FIELD_MAP.MARITAL_STATUS]) || "—",
    placeOfMinistry:
      getPropertyText(properties[NOTION_FIELD_MAP.PLACE_OF_MINISTRY]) || "—",
    church: getPropertyText(properties[NOTION_FIELD_MAP.CHURCH]) || "—",
    role: getPropertyText(properties[NOTION_FIELD_MAP.ROLE]) || "",
    publishStatus,
    note: getPropertyText(properties[NOTION_FIELD_MAP.NOTE]) || "",
    text: getPropertyText(properties[NOTION_FIELD_MAP.TEXT]) || "",
    photo: getPropertyFile(properties[NOTION_FIELD_MAP.PHOTO]) || "",
    createdTime:
      page?.properties?.Created?.created_time ||
      page?.created_time ||
      new Date(0).toISOString(),
    isReady: publishStatus.toLowerCase() === "готово",
  };
}

function getPropertyText(property) {
  if (!property || typeof property !== "object") return "";

  switch (property.type) {
    case "title":
      return joinRichText(property.title);
    case "rich_text":
      return joinRichText(property.rich_text);
    case "number":
      return property.number != null ? String(property.number) : "";
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "multi_select":
      return Array.isArray(property.multi_select)
        ? property.multi_select.map((item) => item?.name).filter(Boolean).join(", ")
        : "";
    case "people":
      return Array.isArray(property.people)
        ? property.people.map((item) => item?.name).filter(Boolean).join(", ")
        : "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "url":
      return property.url || "";
    case "date":
      return property.date?.start || "";
    case "checkbox":
      return property.checkbox ? "Yes" : "No";
    case "formula":
      return getFormulaText(property.formula);
    default:
      return "";
  }
}

function joinRichText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item?.plain_text || "").join("").trim();
}

function getFormulaText(formula) {
  if (!formula || typeof formula !== "object") return "";

  switch (formula.type) {
    case "string":
      return formula.string || "";
    case "number":
      return formula.number != null ? String(formula.number) : "";
    case "boolean":
      return formula.boolean ? "Так" : "Ні";
    case "date":
      return formula.date?.start || "";
    default:
      return "";
  }
}

function getPropertyFile(property) {
  if (!property || property.type !== "files" || !Array.isArray(property.files)) {
    return "";
  }

  const firstFile = property.files[0];
  if (!firstFile) return "";

  if (firstFile.type === "external") {
    return firstFile.external?.url || "";
  }

  if (firstFile.type === "file") {
    return firstFile.file?.url || "";
  }

  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
