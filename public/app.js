const SUPPORT_URL =
  window.APP_CONFIG?.supportUrl ||
  "https://give.tithe.ly/?formId=3966c1ff-6865-11ee-90fc-1260ab546d11&locationId=3bff1725-a576-4eec-bcef-43283ffbbbfc&fundId=83ca1801-4d23-4e39-bc14-f4d2be128809&amount=2500";

const API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || "/api/profiles";

let cardVisibilityObserver = null;
let cardFadeObserver = null;

const state = {
  profiles: [],
  filteredProfiles: [],
  selectedId: null,
  query: "",
  modalOpen: false,
};

const elements = {
  mainShell: document.getElementById("mainShell"),
  profilesGrid: document.getElementById("profilesGrid"),
  statusMessage: document.getElementById("statusMessage"),
  searchInput: document.getElementById("searchInput"),
  randomProfileButton: document.getElementById("randomProfileButton"),
  randomProfileButtonDetail: document.getElementById("randomProfileButtonDetail"),
  scrollToProfilesButton: document.getElementById("scrollToProfilesButton"),
  globalSupportButton: document.getElementById("globalSupportButton"),

  modalBackdrop: document.getElementById("modalBackdrop"),
  profileModal: document.getElementById("profileModal"),
  closeModalButton: document.getElementById("closeModalButton"),

  detailPhoto: document.getElementById("detailPhoto"),
  detailName: document.getElementById("detailName"),
  detailNote: document.getElementById("detailNote"),
  detailAge: document.getElementById("detailAge"),
  detailMaritalStatus: document.getElementById("detailMaritalStatus"),
  detailPlaceOfMinistry: document.getElementById("detailPlaceOfMinistry"),
  detailChurch: document.getElementById("detailChurch"),
  detailText: document.getElementById("detailText"),
  detailSupportButton: document.getElementById("detailSupportButton"),
};

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Сталася помилка під час ініціалізації.", "error");
});

async function init() {
  bindEvents();

  elements.globalSupportButton.href = SUPPORT_URL;
  elements.detailSupportButton.href = SUPPORT_URL;

  const items = await fetchProfiles();
  state.profiles = items;
  state.filteredProfiles = items.slice();

  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.randomProfileButton.addEventListener("click", selectRandomProfile);
  elements.randomProfileButtonDetail.addEventListener("click", selectRandomProfile);
  elements.scrollToProfilesButton.addEventListener("click", () => {
    document.getElementById("profiles")?.scrollIntoView({ behavior: "smooth" });
  });

  elements.closeModalButton.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modalOpen) {
      closeModal();
    }
  });
}

async function fetchProfiles() {
  setStatus("Завантаження анкет...", "loading");

  const response = await fetch(API_BASE_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`Сервер повернув не JSON. Статус: ${response.status}`);
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Не вдалося завантажити анкети. Код: ${response.status}`;
    throw new Error(message);
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  setStatus(
    items.length
      ? `Знайдено анкет: ${items.length}`
      : "Немає доступних анкет зі статусом “Готово”.",
    items.length ? "success" : "loading"
  );

  return items;
}

function handleSearchInput(event) {
  state.query = event.target.value.trim().toLowerCase();
  applyFilters();
  renderGrid();

  if (state.modalOpen && state.selectedId) {
    const stillExists = state.filteredProfiles.some((p) => p.id === state.selectedId);
    if (!stillExists) {
      closeModal();
    }
  }
}

function applyFilters() {
  const query = state.query;

  if (!query) {
    state.filteredProfiles = state.profiles.slice();
    return;
  }

  state.filteredProfiles = state.profiles.filter((profile) => {
    const haystack = [
      profile.name,
      profile.age,
      profile.maritalStatus,
      profile.placeOfMinistry,
      profile.church,
      profile.note,
      profile.text,
      profile.role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function selectProfile(id) {
  state.selectedId = id;
  openModal();
  renderDetail();
  highlightActiveCard();
}

function selectRandomProfile() {
  if (!state.filteredProfiles.length) return;

  const randomIndex = Math.floor(Math.random() * state.filteredProfiles.length);
  const randomProfile = state.filteredProfiles[randomIndex];
  state.selectedId = randomProfile.id;

  openModal();
  renderDetail();
  highlightActiveCard();

  const targetCard = elements.profilesGrid.querySelector(`[data-profile-id="${randomProfile.id}"]`);
  targetCard?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openModal() {
  state.modalOpen = true;
  elements.profileModal.classList.remove("hidden");
  elements.modalBackdrop.classList.remove("hidden");

  requestAnimationFrame(() => {
    elements.profileModal.classList.add("is-visible");
    elements.modalBackdrop.classList.add("is-visible");
    elements.mainShell.classList.add("is-blurred");
    elements.profileModal.setAttribute("aria-hidden", "false");
  });
}

function closeModal() {
  state.modalOpen = false;
  elements.profileModal.classList.remove("is-visible");
  elements.modalBackdrop.classList.remove("is-visible");
  elements.mainShell.classList.remove("is-blurred");
  elements.profileModal.setAttribute("aria-hidden", "true");

  setTimeout(() => {
    if (!state.modalOpen) {
      elements.profileModal.classList.add("hidden");
      elements.modalBackdrop.classList.add("hidden");
    }
  }, 420);

  highlightActiveCard();
}

function render() {
  renderGrid();

  if (state.selectedId && state.modalOpen) {
    renderDetail();
  }
}

function renderGrid() {
  const items = state.filteredProfiles;
  elements.profilesGrid.innerHTML = "";

  if (!items.length) {
    elements.profilesGrid.innerHTML = `
      <div class="status-message">
        За вашим запитом нічого не знайдено.
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((profile) => {
    const card = document.createElement("article");
    card.className = `profile-card${profile.id === state.selectedId && state.modalOpen ? " is-active" : ""}`;
    card.classList.add("is-hidden-before");
    card.dataset.profileId = profile.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Відкрити анкету ${profile.name}`);

    const photoUrl = profile.photo || createFallbackImage(profile.name);

    card.innerHTML = `
      <div class="profile-card-photo-wrap">
        <img
          class="profile-card-photo"
          src="${escapeHtml(photoUrl)}"
          alt="${escapeHtml(profile.name)}"
          loading="lazy"
        />
      </div>
      <div class="profile-card-overlay">
        <h3 class="profile-card-name">${escapeHtml(profile.name)}</h3>
        <div class="profile-card-sub">
          ${escapeHtml(compactMeta(profile))}
        </div>
        <div class="profile-card-snippet">
          ${escapeHtml(trimText(profile.note || profile.text || "Без опису", 120))}
        </div>
        <span class="profile-card-badge">
          ${escapeHtml(profile.placeOfMinistry || profile.church || "Анкета")}
        </span>
      </div>
    `;

    card.addEventListener("click", () => selectProfile(profile.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectProfile(profile.id);
      }
    });

    fragment.appendChild(card);
  });

  elements.profilesGrid.appendChild(fragment);
  setupCardScrollAnimations();
}

function renderDetail() {
  const profile = state.filteredProfiles.find((item) => item.id === state.selectedId) || null;
  if (!profile) return;

  const photoUrl = profile.photo || createFallbackImage(profile.name);

  elements.detailPhoto.src = photoUrl;
  elements.detailPhoto.alt = profile.name;
  elements.detailName.textContent = profile.name || "Без імені";
  elements.detailAge.textContent = profile.age || "—";
  elements.detailMaritalStatus.textContent = profile.maritalStatus || "—";
  elements.detailPlaceOfMinistry.textContent = profile.placeOfMinistry || "—";
  elements.detailChurch.textContent = profile.church || "—";
  elements.detailText.textContent = profile.text || profile.note || "Опис поки відсутній.";
  elements.detailSupportButton.href = SUPPORT_URL;

  if (profile.note) {
    elements.detailNote.textContent = profile.note;
    elements.detailNote.classList.remove("hidden");
  } else {
    elements.detailNote.classList.add("hidden");
    elements.detailNote.textContent = "";
  }
}

function highlightActiveCard() {
  const cards = elements.profilesGrid.querySelectorAll(".profile-card");
  cards.forEach((card) => {
    const active = state.modalOpen && card.dataset.profileId === state.selectedId;
    card.classList.toggle("is-active", active);
  });
}

function setStatus(message, type = "loading") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = "status-message";

  if (type === "error") {
    elements.statusMessage.classList.add("is-error");
  } else if (type === "success") {
    elements.statusMessage.classList.add("is-success");
  } else {
    elements.statusMessage.classList.add("is-loading");
  }
}

function compactMeta(profile) {
  return [
    profile.age ? `${profile.age}` : "",
    profile.maritalStatus || "",
    profile.church || "",
  ]
    .filter(Boolean)
    .join(" • ");
}

function trimText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd() + "…";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createFallbackImage(name) {
  const initials = String(name || "Людина")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#dfe7ff"/>
          <stop offset="100%" stop-color="#eef3ff"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1200" fill="url(#bg)"/>
      <circle cx="400" cy="380" r="150" fill="#b9c9ff"/>
      <path d="M160 940c40-170 145-260 240-260s200 90 240 260" fill="#b9c9ff"/>
      <text x="400" y="1080" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#17377d">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setupCardScrollAnimations() {
  if (cardVisibilityObserver) {
    cardVisibilityObserver.disconnect();
  }

  if (cardFadeObserver) {
    cardFadeObserver.disconnect();
  }

  const cards = elements.profilesGrid.querySelectorAll(".profile-card");
  if (!cards.length) return;

  cardVisibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = entry.target;

        if (entry.isIntersecting) {
          card.classList.add("is-visible");
          card.classList.remove("is-hidden-before");
        } else {
          if (entry.boundingClientRect.top > window.innerHeight * 0.75) {
            card.classList.remove("is-visible");
            card.classList.add("is-hidden-before");
          }
        }
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  cardFadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const rect = entry.boundingClientRect;
        const fadeTopZone = 110;

        if (rect.top < fadeTopZone && rect.bottom > 0) {
          card.classList.add("is-fading-out");
        } else {
          card.classList.remove("is-fading-out");
        }
      });
    },
    {
      root: null,
      threshold: [0, 0.1, 0.2, 0.4, 0.8, 1],
    }
  );

  cards.forEach((card) => {
    card.classList.add("is-hidden-before");
    cardVisibilityObserver.observe(card);
    cardFadeObserver.observe(card);
  });
}