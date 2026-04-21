const DONATE_URL =
  "https://give.tithe.ly/?formId=3966c1ff-6865-11ee-90fc-1260ab546d11&locationId=3bff1725-a576-4eec-bcef-43283ffbbbfc&fundId=83ca1801-4d23-4e39-bc14-f4d2be128809&amount=2500";

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

const APP_CONFIG = {
  apiBaseUrl: window.APP_CONFIG?.apiBaseUrl || "/api/profiles",
  placeholderImage:
    window.APP_CONFIG?.placeholderImage ||
    "data:image/svg+xml;utf8," +
      encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 720">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e3e99" />
            <stop offset="100%" stop-color="#89a3ff" />
          </linearGradient>
        </defs>
        <rect width="640" height="720" rx="44" fill="url(#g)"/>
        <circle cx="320" cy="250" r="120" fill="rgba(255,255,255,.82)"/>
        <path d="M160 590c24-96 106-152 160-152s136 56 160 152" fill="rgba(255,255,255,.82)"/>
      </svg>
    `),
};

const state = {
  allProfiles: [],
  visibleProfiles: [],
  selectedId: null,
  searchTerm: "",
};

const els = {
  profilesGrid: document.getElementById("profilesGrid"),
  profilesEmpty: document.getElementById("profilesEmpty"),
  detailsPanel: document.getElementById("detailsPanel"),
  detailsLoading: document.getElementById("detailsLoading"),
  detailsContent: document.getElementById("detailsContent"),
  searchInput: document.getElementById("searchInput"),
  randomProfileBtn: document.getElementById("randomProfileBtn"),
  heroRandomBtn: document.getElementById("heroRandomBtn"),
  profilesCounter: document.getElementById("profilesCounter"),
  profileCardTemplate: document.getElementById("profileCardTemplate"),
};

init().catch((error) => {
  console.error(error);
  showFatalState(error);
});

async function init() {
  wireEvents();
  const profiles = await fetchProfiles();
  state.allProfiles = profiles;
  state.visibleProfiles = profiles;
  state.selectedId = profiles[0]?.id || null;
  render();
}

function wireEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    filterProfiles();
    renderProfiles();
    syncSelectedProfile();
  });

  els.randomProfileBtn.addEventListener("click", selectRandomProfile);
  els.heroRandomBtn.addEventListener("click", selectRandomProfile);
}

async function fetchProfiles() {
  const response = await fetch(APP_CONFIG.apiBaseUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Не вдалося завантажити анкети. Код: ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.items) ? payload.items : payload;

  return items
    .map(normalizeProfile)
    .filter((profile) => profile.isReady)
    .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
}

function normalizeProfile(item) {
  if (item?.id && item?.name && item?.photo !== undefined) {
    return {
      id: String(item.id),
      name: item.name || "Без імені",
      age: item.age || "—",
      maritalStatus: item.maritalStatus || "Не вказано",
      placeOfMinistry: item.placeOfMinistry || "Не вказано",
      church: item.church || "Не вказано",
      position: item.position || "Не вказано",
      note: item.note || "",
      text: item.text || "",
      photo: item.photo || APP_CONFIG.placeholderImage,
      createdTime: item.createdTime || new Date().toISOString(),
      isReady: item.isReady !== false,
    };
  }

  const properties = item?.properties || {};
  const positionValue = getPropertyText(properties[FIELD_MAP.POSITION]);
  return {
    id: item.id,
    name: getPropertyText(properties[FIELD_MAP.NAME]) || "Без імені",
    age: getPropertyText(properties[FIELD_MAP.AGE]) || "—",
    maritalStatus: getPropertyText(properties[FIELD_MAP.MARITAL_STATUS]) || "Не вказано",
    placeOfMinistry:
      getPropertyText(properties[FIELD_MAP.PLACE_OF_MINISTRY]) || "Не вказано",
    church: getPropertyText(properties[FIELD_MAP.CHURCH]) || "Не вказано",
    position: positionValue || "Не вказано",
    note: getPropertyText(properties[FIELD_MAP.NOTE]) || "",
    text: getPropertyText(properties[FIELD_MAP.TEXT]) || "",
    photo: getPropertyFile(properties[FIELD_MAP.PHOTO]) || APP_CONFIG.placeholderImage,
    createdTime: item.created_time || new Date().toISOString(),
    isReady: positionValue.trim().toLowerCase() === "готово",
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
    case "people":
      return property.people?.map((item) => item.name).join(", ") || "";
    case "url":
      return property.url || "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "date":
      return property.date?.start || "";
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

function filterProfiles() {
  if (!state.searchTerm) {
    state.visibleProfiles = [...state.allProfiles];
    return;
  }

  const term = state.searchTerm;
  state.visibleProfiles = state.allProfiles.filter((profile) => {
    const haystack = [
      profile.name,
      profile.age,
      profile.maritalStatus,
      profile.placeOfMinistry,
      profile.church,
      profile.note,
      profile.text,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

function syncSelectedProfile() {
  const exists = state.visibleProfiles.some((profile) => profile.id === state.selectedId);
  if (!exists) {
    state.selectedId = state.visibleProfiles[0]?.id || null;
  }
  renderDetails();
}

function render() {
  els.profilesCounter.textContent = String(state.allProfiles.length);
  renderProfiles();
  renderDetails();
}

function renderProfiles() {
  els.profilesGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.visibleProfiles.forEach((profile) => {
    const node = els.profileCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = profile.id;
    node.classList.toggle("is-active", profile.id === state.selectedId);

    const img = node.querySelector(".profile-card-image");
    img.src = profile.photo || APP_CONFIG.placeholderImage;
    img.alt = `Фото: ${profile.name}`;

    node.querySelector(".profile-chip").textContent = profile.placeOfMinistry || "Анкета";
    node.querySelector(".profile-card-name").textContent = profile.name;
    node.querySelector(".profile-card-age").textContent = profile.age !== "—" ? `${profile.age} р.` : "—";

    const meta = node.querySelector(".profile-card-meta");
    [profile.church, profile.maritalStatus]
      .filter(Boolean)
      .slice(0, 2)
      .forEach((value) => {
        const badge = document.createElement("span");
        badge.textContent = value;
        meta.appendChild(badge);
      });

    node.querySelector(".profile-card-note").textContent =
      profile.note || profile.text || "Історія поки що не заповнена.";

    node.querySelector(".profile-card-hitbox").addEventListener("click", () => {
      state.selectedId = profile.id;
      renderProfiles();
      renderDetails();
      document.getElementById("detailsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    fragment.appendChild(node);
  });

  els.profilesGrid.appendChild(fragment);
  els.profilesEmpty.classList.toggle("hidden", state.visibleProfiles.length > 0);
}

function renderDetails() {
  const selected = state.visibleProfiles.find((profile) => profile.id === state.selectedId);

  if (!selected) {
    els.detailsLoading.classList.add("hidden");
    els.detailsContent.classList.remove("hidden");
    els.detailsContent.innerHTML = `
      <div class="content-card">
        <h3>Анкета не вибрана</h3>
        <p>Оберіть анкету ліворуч або скористайтеся випадковим вибором.</p>
      </div>
    `;
    return;
  }

  els.detailsLoading.classList.add("hidden");
  els.detailsContent.classList.remove("hidden");
  els.detailsContent.innerHTML = `
    <div class="details-topbar">
      <button class="details-back" type="button">← До списку анкет</button>
      <div class="details-actions">
        <button class="icon-button" type="button" title="Поділитися">↗</button>
        <a class="button button-primary" href="${DONATE_URL}" target="_blank" rel="noreferrer">Підтримати</a>
      </div>
    </div>

    <div class="details-hero">
      <img class="details-photo" src="${escapeHtml(selected.photo || APP_CONFIG.placeholderImage)}" alt="Фото: ${escapeHtml(selected.name)}" />
      <div class="details-head">
        <h2>${escapeHtml(selected.name)}${selected.age !== "—" ? `, ${escapeHtml(selected.age)}` : ""}</h2>
        <div class="details-subline">📍 ${escapeHtml(selected.placeOfMinistry)}</div>
        <div class="details-badges">
          <span class="details-badge">${escapeHtml(selected.church)}</span>
          <span class="details-badge">${escapeHtml(selected.maritalStatus)}</span>
        </div>
        <div class="details-quote">
          ${escapeHtml(selected.note || "Ми підтримуємо тих, хто потребує турботи, уваги і реальної участі.")}
        </div>
        <div class="details-support">
          <a class="button button-primary" href="${DONATE_URL}" target="_blank" rel="noreferrer">Підтримати анкету</a>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Вік</div>
        <div class="stat-value">${escapeHtml(selected.age)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Сімейний стан</div>
        <div class="stat-value">${escapeHtml(selected.maritalStatus)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Місце служіння</div>
        <div class="stat-value">${escapeHtml(selected.placeOfMinistry)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Церква</div>
        <div class="stat-value">${escapeHtml(selected.church)}</div>
      </div>
    </div>

    <div class="content-card">
      <h3>Історія</h3>
      <p>${escapeHtml(selected.text || selected.note || "Опис поки що не заповнений.")}</p>
    </div>

    <div class="content-card">
      <h3>Як можна допомогти</h3>
      <div class="support-grid">
        <div class="support-item">
          <strong>Фінансова підтримка</strong>
          <span>Пожертва веде на вашу фіксовану сторінку збору.</span>
        </div>
        <div class="support-item">
          <strong>Молитва і увага</strong>
          <span>Не все вирішують гроші. Часто важлива присутність і підбадьорення.</span>
        </div>
        <div class="support-item">
          <strong>Поширення історії</strong>
          <span>Чим більше людей дізнаються про потребу, тим вища реальна допомога.</span>
        </div>
      </div>
    </div>

    <div class="notice-box">
      <div class="notice-icon">🛡</div>
      <div>
        <strong>На сайт потрапляють лише анкети зі статусом “Готово”.</strong>
        <p>Усі інші записи ігноруються до моменту фінальної готовності.</p>
      </div>
    </div>
  `;

  els.detailsContent.querySelector(".details-back")?.addEventListener("click", () => {
    document.getElementById("profiles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.detailsContent.querySelector(".icon-button")?.addEventListener("click", async () => {
    const shareUrl = `${location.origin}${location.pathname}#${selected.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: selected.name,
          text: selected.note || "Погляньте на цю анкету підтримки",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      alert("Посилання на анкету скопійовано.");
    } catch (error) {
      console.error(error);
    }
  });
}

function selectRandomProfile() {
  if (!state.visibleProfiles.length) return;
  const randomIndex = Math.floor(Math.random() * state.visibleProfiles.length);
  state.selectedId = state.visibleProfiles[randomIndex].id;
  renderProfiles();
  renderDetails();
  document.getElementById("detailsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showFatalState(error) {
  els.detailsLoading.classList.add("hidden");
  els.detailsContent.classList.remove("hidden");
  els.detailsContent.innerHTML = `
    <div class="content-card">
      <h3>Помилка завантаження</h3>
      <p>${escapeHtml(error.message || "Сталася невідома помилка.")}</p>
      <p>Для GitHub Pages це очікувано, якщо немає окремого серверного проксі для Notion API.</p>
    </div>
  `;
}
