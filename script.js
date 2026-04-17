import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, push, set, remove, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyACT86jRZzbIoRu03zmdak5fvWVmiRef14",
  authDomain: "drali-f6b14.firebaseapp.com",
  databaseURL: "https://drali-f6b14-default-rtdb.firebaseio.com",
  projectId: "drali-f6b14",
  storageBucket: "drali-f6b14.firebasestorage.app",
  messagingSenderId: "726312902342",
  appId: "1:726312902342:web:2bede86bf9ca3baeed81c7",
  measurementId: "G-VGC2C6VXR2"
};

const TELEGRAM_CONFIG = {
  TOKEN: "7778672069:AAFgaixgb9rjlXTp8T9N3GMObtAX4U64nq0",
  CHAT_ID: "8588944574"
};

const ADMIN_EMAIL = "doctor.ali.saad@gmail.com";
const ADMIN_PASSWORD = "admin2026";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const CATEGORIES = [
  { id: "rescue", name: "إنقاذ الغرقي والاسعافات الأولية", icon: "◎", desc: "تعلم أساسيات وتقنيات الإنقاذ المائي." },
  { id: "instructor", name: "كورس إعداد معلم السباحة", icon: "▣", desc: "برنامج شامل لإعداد معلمين محترفين." },
  { id: "golden", name: "برنامج البطل الذهبي لتعليم السباحة", icon: "☆", desc: "برنامج متكامل لتعليم السباحة." },
  { id: "general", name: "عام (للجميع)", icon: "◇", desc: "محتوى تعليمي متاح للجميع." }
];

const state = {
  currentUser: null,
  isAdmin: false,
  activeStudentTab: "announcements",
  activeAdminTab: "users",
  activeCategory: "all",
  users: {},
  videos: {},
  pdfs: {},
  announcements: {},
  schedules: {},
  settings: { aboutText: "", contactText: "", backgroundUrl: "", backgroundYoutubeUrl: "" }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(text, type = "success") {
  const el = $("#authMessage");
  el.textContent = text;
  el.className = `message ${type}`;
}

function clearMessage() {
  const el = $("#authMessage");
  el.textContent = "";
  el.className = "message hidden";
}

async function sendTelegramMessage(text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CONFIG.CHAT_ID, text })
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function saveSession() {
  localStorage.setItem("drAliSession", JSON.stringify({
    currentUser: state.currentUser,
    isAdmin: state.isAdmin
  }));
}

function loadSession() {
  const saved = localStorage.getItem("drAliSession");
  if (!saved) return;
  try {
    const session = JSON.parse(saved);
    state.currentUser = session.currentUser || null;
    state.isAdmin = Boolean(session.isAdmin);
  } catch (error) {
    localStorage.removeItem("drAliSession");
  }
}

function logout() {
  state.currentUser = null;
  state.isAdmin = false;
  localStorage.removeItem("drAliSession");
  updateNav();
  goTo("home", { replace: true });
}

function updateHash(route, options = {}) {
  if (options.skipHash) return;
  const hash = options.hash || route;
  const target = `${location.pathname}${location.search}#${hash}`;
  if (location.hash === `#${hash}`) return;
  if (options.replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);
}

function goTo(route, options = {}) {
  $$(".page").forEach(page => page.classList.remove("active"));
  if (route === "auth") $("#authPage").classList.add("active");
  else if (route === "student") $("#studentPage").classList.add("active");
  else if (route === "admin") $("#adminPage").classList.add("active");
  else $("#homePage").classList.add("active");
  $("#mainNav").classList.remove("open");
  updateHash(route, options);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function routeFromHash() {
  const hash = location.hash.replace("#", "");
  if (hash === "admin") {
    if (state.isAdmin) goTo("admin", { skipHash: true });
    else goTo("home", { replace: true });
    return;
  }
  if (hash === "student") {
    if (state.currentUser && state.currentUser.status === "approved") goTo("student", { skipHash: true });
    else goTo("home", { replace: true });
    return;
  }
  if (hash === "login" || hash === "register") {
    openAuth(hash);
    return;
  }
  goTo("home", { skipHash: true });
}

function updateNav() {
  const loggedIn = Boolean(state.currentUser);
  $$(".auth-only").forEach(el => el.classList.toggle("hidden", !loggedIn || state.isAdmin));
  $$(".admin-only").forEach(el => el.classList.toggle("hidden", !state.isAdmin));
  $("#loginNavBtn").classList.toggle("hidden", loggedIn);
  $("#logoutBtn").classList.toggle("hidden", !loggedIn);
}

function openAuth(mode = "login") {
  clearMessage();
  goTo("auth", { hash: mode });
  const loginActive = mode !== "register";
  $("#showLogin").classList.toggle("active", loginActive);
  $("#showRegister").classList.toggle("active", !loginActive);
  $("#loginForm").classList.toggle("active-form", loginActive);
  $("#registerForm").classList.toggle("active-form", !loginActive);
}

function subscribe(path, callback) {
  return onValue(ref(db, path), snapshot => callback(snapshot.val() || {}));
}

function setupRealtimeListeners() {
  subscribe("users", data => { state.users = data; renderAdminContent(); });
  subscribe("videos", data => { state.videos = data; renderStudentContent(); renderAdminContent(); });
  subscribe("pdfs", data => { state.pdfs = data; renderStudentContent(); renderAdminContent(); });
  subscribe("announcements", data => { state.announcements = data; renderHome(); renderStudentContent(); renderAdminContent(); maybeShowLatestAnnouncement(); });
  subscribe("schedules", data => { state.schedules = data; renderStudentContent(); renderAdminContent(); });
  subscribe("settings", data => { state.settings = { aboutText: "", contactText: "", backgroundUrl: "", backgroundYoutubeUrl: "", ...data }; renderHome(); renderAdminContent(); });
}

function sortedEntries(object) {
  return Object.entries(object || {}).sort(([, a], [, b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function imageList(value = "") {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value).split(/\n|,/).map(item => item.trim()).filter(Boolean);
}

function youtubeEmbedUrl(url = "", params = {}) {
  const id = youtubeId(url);
  if (!id) return "";
  const query = new URLSearchParams({
    enablejsapi: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    ...params
  });
  return `https://www.youtube.com/embed/${id}?${query.toString()}`;
}

function setYoutubeParam(src = "", key, value) {
  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set(key, value);
    return url.toString();
  } catch (error) {
    return src;
  }
}

function youtubeLoopUrl(url = "", extra = "") {
  const id = youtubeId(url);
  if (!id) return "";
  const extraParams = new URLSearchParams(extra.replace(/^&/, ""));
  return youtubeEmbedUrl(id, {
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id,
    ...Object.fromEntries(extraParams.entries())
  });
}

function announcementImagesHtml(images = []) {
  const list = imageList(images);
  if (!list.length) return "";
  const repeated = [...list, ...list];
  return `
    <div class="announcement-images-slider" dir="ltr">
      <div class="announcement-images-track">
        ${repeated.map((src, index) => `
          <div class="announcement-image-slide">
            <img src="${escapeHtml(src)}" alt="إعلان ${index + 1}">
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderHome() {
  $("#publicCategories").innerHTML = CATEGORIES.map(cat => `
    <article class="category-card">
      <span class="category-icon">${cat.icon}</span>
      <h3>${cat.name}</h3>
      <p>${cat.desc}</p>
    </article>
  `).join("");

  const latestAnnouncements = sortedEntries(state.announcements).slice(0, 5);
  const latestBox = $("#latestAnnouncement");
  if (latestAnnouncements.length) {
    latestBox.classList.remove("hidden");
    latestBox.innerHTML = `
      <div class="home-announcements-head">
        <div>
          <strong>أحدث الإعلانات</strong>
          <h2>آخر ٥ إعلانات</h2>
        </div>
        <span>من الأحدث للأقدم</span>
      </div>
      <div class="home-announcements-list">
        ${latestAnnouncements.map(([, ann]) => {
          const videoSrc = ann.youtubeUrl ? youtubeEmbedUrl(ann.youtubeUrl) : "";
          const images = imageList(ann.imageUrls || ann.imageUrl);
          return `
            <article class="announcement-preview home-announcement-card" data-open-announcement="${escapeHtml(ann.title)}">
              ${videoSrc ? `
                <div class="announcement-video-wrap">
                  <div class="youtube-player-wrap">
                    <iframe class="video-frame"
                      data-src="${videoSrc}"
                      allow="autoplay; encrypted-media; picture-in-picture"></iframe>
                    <span class="youtube-share-blocker" aria-hidden="true"></span>
                    <button class="youtube-play-btn" type="button" aria-label="تشغيل الفيديو">▶</button>
                    <button class="youtube-fullscreen-btn" type="button" aria-label="ملء الشاشة">⛶</button>
                  </div>
                </div>
              ` : announcementImagesHtml(images)}
              <div>
                <strong>إعلان</strong>
                <h3>${escapeHtml(ann.title)}</h3>
                <p>${escapeHtml(ann.text)}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  } else {
    latestBox.classList.add("hidden");
  }

  const about = state.settings.aboutText || "";
  const contact = state.settings.contactText || "";
  $("#aboutSection").classList.toggle("hidden", !about.trim());
  $("#contactSection").classList.toggle("hidden", !contact.trim());
  $("#aboutText").textContent = about;
  $("#contactText").textContent = contact;

  const hero = $("#heroSection");
  hero.querySelector(".hero-youtube-bg")?.remove();
  const backgroundVideoSrc = youtubeLoopUrl(state.settings.backgroundYoutubeUrl, "&controls=0&disablekb=1&modestbranding=1");
  if (backgroundVideoSrc) {
    hero.style.backgroundImage = "";
    hero.insertAdjacentHTML("afterbegin", `
      <div class="hero-youtube-bg" aria-hidden="true">
        <iframe src="${backgroundVideoSrc}" title="خلفية المنصة" allow="autoplay; encrypted-media; picture-in-picture"></iframe>
      </div>
    `);
  } else if (state.settings.backgroundUrl) {
    hero.style.backgroundImage = `url('${state.settings.backgroundUrl}')`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  } else {
    hero.style.backgroundImage = "";
  }
}

async function registerUser(data) {
  const usersSnap = await get(ref(db, "users"));
  const users = usersSnap.val() || {};
  const exists = Object.values(users).some(user => user.email === data.email);
  if (exists) throw new Error("البريد الإلكتروني مسجل بالفعل");
  const newUser = { ...data, status: "pending", createdAt: new Date().toISOString() };
  await set(push(ref(db, "users")), newUser);
  await sendTelegramMessage(`طلب عضوية جديد\n\nالاسم: ${data.fullName}\nالهاتف: ${data.phone}\nالبريد الإلكتروني: ${data.email}\nالباسورد: ${data.password}\n\nهل تريد إضافة هذا العضو؟`);
}

async function loginUser(email, password) {
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    state.currentUser = { id: "admin", fullName: "الدكتور علي سعد", email, status: "approved" };
    state.isAdmin = true;
    saveSession();
    updateNav();
    goTo("admin", { replace: true });
    renderAdminContent();
    return;
  }

  const usersSnap = await get(ref(db, "users"));
  const users = usersSnap.val() || {};
  const foundEntry = Object.entries(users).find(([, user]) => user.email === email && user.password === password);
  if (!foundEntry) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");

  const [id, user] = foundEntry;
  if (user.status === "pending") throw new Error("حسابك قيد المراجعة، يرجى انتظار موافقة الأدمن");
  if (user.status === "blocked") throw new Error("تم حظر حسابك، تواصل مع الإدارة");

  state.currentUser = { id, ...user };
  state.isAdmin = false;
  saveSession();
  updateNav();
  goTo("student", { replace: true });
  renderStudentContent();
}

function youtubeId(url = "") {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function renderCategoryFilter(show) {
  const filter = $("#categoryFilter");
  filter.classList.toggle("hidden", !show);
  if (!show) return;
  filter.innerHTML = `
    <button class="${state.activeCategory === "all" ? "active" : ""}" data-category="all">الكل</button>
    ${CATEGORIES.map(cat => `<button class="${state.activeCategory === cat.id ? "active" : ""}" data-category="${cat.id}">${cat.name}</button>`).join("")}
  `;
  filter.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.category;
      renderStudentContent();
    });
  });
}

function filterByCategory(entries) {
  if (state.activeCategory === "all") return entries;
  return entries.filter(([, item]) => item.category === state.activeCategory);
}

function renderStudentContent() {
  if (!$("#studentContent")) return;
  if (state.currentUser && !state.isAdmin) {
    $("#studentWelcome").textContent = `مرحبا، ${state.currentUser.fullName}`;
  }

  $$(".content-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === state.activeStudentTab));
  renderCategoryFilter(["videos", "pdfs"].includes(state.activeStudentTab));

  const box = $("#studentContent");
  if (state.activeStudentTab === "announcements") {
    const entries = sortedEntries(state.announcements);
    box.innerHTML = entries.length ? entries.map(([, ann]) => {
      const videoSrc = ann.youtubeUrl ? youtubeEmbedUrl(ann.youtubeUrl) : "";
      const images = imageList(ann.imageUrls || ann.imageUrl);
      return `
        <article class="item-card" data-open-announcement="${escapeHtml(ann.title)}">
          ${videoSrc ? `
            <div class="youtube-player-wrap">
              <iframe class="video-frame"
                data-src="${videoSrc}"
                allow="autoplay; encrypted-media; picture-in-picture"></iframe>
              <span class="youtube-share-blocker" aria-hidden="true"></span>
              <button class="youtube-play-btn" type="button" aria-label="تشغيل الفيديو">▶</button>
              <button class="youtube-fullscreen-btn" type="button" aria-label="ملء الشاشة">⛶</button>
            </div>
          ` : announcementImagesHtml(images)}
          <h3>${escapeHtml(ann.title)}</h3>
          <p>${escapeHtml(ann.text)}</p>
        </article>
      `;
    }).join("") : `<div class="empty-state">لا توجد إعلانات حاليا</div>`;
    return;
  }

  if (state.activeStudentTab === "videos") {
    const entries = filterByCategory(sortedEntries(state.videos));
    box.innerHTML = entries.length ? entries.map(([, video]) => {
      const id = youtubeId(video.url);
      const shortClass = video.url && video.url.includes("/shorts/") ? " short" : "";
      const videoSrc = youtubeEmbedUrl(video.url);
      return `
        <article class="item-card">
          ${id ? `
            <div class="youtube-player-wrap${shortClass}">
              <iframe class="video-frame${shortClass}" data-src="${videoSrc}" allow="autoplay; encrypted-media; picture-in-picture"></iframe>
              <span class="youtube-share-blocker" aria-hidden="true"></span>
              <button class="youtube-play-btn" type="button" aria-label="تشغيل الفيديو">▶</button>
              <button class="youtube-fullscreen-btn" type="button" aria-label="ملء الشاشة">⛶</button>
            </div>
          ` : ""}
          <h3>${escapeHtml(video.title)}</h3>
          <p>${categoryName(video.category)}</p>
        </article>
      `;
    }).join("") : `<div class="empty-state">لا توجد فيديوهات في هذا القسم</div>`;
    return;
  }

  if (state.activeStudentTab === "pdfs") {
    const entries = filterByCategory(sortedEntries(state.pdfs));
    box.innerHTML = entries.length ? entries.map(([, pdf]) => `
      <a class="item-card" href="${escapeHtml(pdf.url)}" target="_blank" rel="noopener noreferrer">
        <div class="pdf-icon">PDF</div>
        <h3>${escapeHtml(pdf.title)}</h3>
        <p>${categoryName(pdf.category)}</p>
      </a>
    `).join("") : `<div class="empty-state">لا توجد ملفات PDF في هذا القسم</div>`;
    return;
  }

  if (state.activeStudentTab === "schedules") {
    const entries = sortedEntries(state.schedules);
    box.innerHTML = entries.length ? entries.map(([, schedule]) => `
      <article class="item-card">
        ${schedule.imageUrl ? `<img src="${escapeHtml(schedule.imageUrl)}" alt="${escapeHtml(schedule.courseTitle)}">` : ""}
        <h3>${escapeHtml(schedule.courseTitle)}</h3>
        <p>${escapeHtml(schedule.description || "")}</p>
        <p><strong>من:</strong> ${escapeHtml(schedule.dateFrom)} <strong>إلى:</strong> ${escapeHtml(schedule.dateTo)}</p>
      </article>
    `).join("") : `<div class="empty-state">لا توجد جداول حاليا</div>`;
  }
}

function maybeShowLatestAnnouncement() {
  if (!state.currentUser || state.isAdmin) return;
  const latest = sortedEntries(state.announcements)[0];
  if (!latest) return;
  const [id, ann] = latest;
  const seenKey = `seenAnnouncement_${id}`;
  if (localStorage.getItem(seenKey)) return;
  localStorage.setItem(seenKey, "yes");
  openAnnouncementModal(ann);
}

function openAnnouncementModal(ann) {
  $("#modalAnnouncementTitle").textContent = ann.title || "إعلان";
  $("#modalAnnouncementText").textContent = ann.text || "";
  const img = $("#modalAnnouncementImage");
  const vidWrap = $("#modalAnnouncementVideo");
  const videoSrc = ann.youtubeUrl ? youtubeEmbedUrl(ann.youtubeUrl) : "";
  const images = imageList(ann.imageUrls || ann.imageUrl);

  if (videoSrc) {
    img.classList.add("hidden");
    vidWrap.classList.remove("hidden");
    vidWrap.innerHTML = `
      <div class="youtube-player-wrap">
        <iframe class="video-frame" data-src="${videoSrc}" allow="autoplay; encrypted-media; picture-in-picture"></iframe>
        <span class="youtube-share-blocker" aria-hidden="true"></span>
        <button class="youtube-play-btn" type="button" aria-label="تشغيل الفيديو">▶</button>
        <button class="youtube-fullscreen-btn" type="button" aria-label="ملء الشاشة">⛶</button>
      </div>
    `;
  } else {
    img.classList.add("hidden");
    vidWrap.classList.add("hidden");
    vidWrap.innerHTML = images.length ? announcementImagesHtml(images) : "";
    vidWrap.classList.toggle("hidden", !images.length);
  }

  $("#announcementModal").classList.remove("hidden");
  document.body.classList.add("no-scroll");
}

function closeAnnouncementModal() {
  const vidWrap = $("#modalAnnouncementVideo");
  if (vidWrap) vidWrap.innerHTML = "";
  $("#announcementModal").classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

function openAnnouncementByTitle(title) {
  const entries = sortedEntries(state.announcements);
  const found = entries.find(([, ann]) => ann.title === title);
  if (found) openAnnouncementModal(found[1]);
}

async function toggleYoutubeFullscreen(button) {
  const player = button.closest(".youtube-player-wrap");
  if (!player) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (player.requestFullscreen) {
      await player.requestFullscreen();
    } else if (player.webkitRequestFullscreen) {
      player.webkitRequestFullscreen();
    }
  } catch (error) {
    return;
  }
}

function toggleYoutubePlayback(button) {
  const player = button.closest(".youtube-player-wrap");
  const iframe = player?.querySelector("iframe");
  if (!iframe) return;
  const isPlaying = button.dataset.playing === "1";
  if (isPlaying) {
    iframe.contentWindow?.postMessage(JSON.stringify({
      event: "command",
      func: "pauseVideo",
      args: []
    }), "*");
  } else {
    const baseSrc = iframe.dataset.src || iframe.src;
    iframe.src = setYoutubeParam(baseSrc, "autoplay", "1");
    setTimeout(() => {
      iframe.contentWindow?.postMessage(JSON.stringify({
        event: "command",
        func: "playVideo",
        args: []
      }), "*");
    }, 250);
  }
  button.dataset.playing = isPlaying ? "0" : "1";
  button.textContent = isPlaying ? "▶" : "❚❚";
  button.setAttribute("aria-label", isPlaying ? "تشغيل الفيديو" : "إيقاف الفيديو");
}

function setupVideoAutoplay() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const iframe = entry.target;
      if (entry.isIntersecting) {
        if (!iframe.src) {
          iframe.src = iframe.dataset.src;
        }
      } else {
        if (iframe.src) {
          iframe.removeAttribute("src");
        }
      }
    });
  }, { threshold: 0.45 });

  document.querySelectorAll(".announcement-autoplay").forEach(iframe => {
    if (!iframe.dataset.observed) {
      iframe.dataset.observed = "1";
      observer.observe(iframe);
    }
  });
}

function categoryName(id) {
  return CATEGORIES.find(cat => cat.id === id)?.name || "عام";
}

function renderAdminContent() {
  if (!state.isAdmin || !$("#adminContent")) return;
  $$(".admin-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.adminTab === state.activeAdminTab));
  const box = $("#adminContent");
  if (state.activeAdminTab === "users") box.innerHTML = renderUsersPanel();
  if (state.activeAdminTab === "videos") box.innerHTML = renderVideosPanel();
  if (state.activeAdminTab === "pdfs") box.innerHTML = renderPdfsPanel();
  if (state.activeAdminTab === "announcements") box.innerHTML = renderAnnouncementsPanel();
  if (state.activeAdminTab === "schedules") box.innerHTML = renderSchedulesPanel();
  if (state.activeAdminTab === "settings") box.innerHTML = renderSettingsPanel();
  bindAdminForms();
}

function renderUsersPanel() {
  const entries = sortedEntries(state.users);
  return `
    <h2>إدارة الأعضاء (${entries.length})</h2>
    ${entries.length ? entries.map(([id, user]) => `
      <article class="user-card">
        <div>
          <h3>${escapeHtml(user.fullName)} <span class="badge ${user.status}">${user.status}</span></h3>
          <p>البريد: ${escapeHtml(user.email)}</p>
          <p>الهاتف: ${escapeHtml(user.phone)} | الرقم القومي: ${escapeHtml(user.nationalId)}</p>
        </div>
        <div class="user-actions">
          <button class="icon-btn btn-success" data-user-status="approved" data-user-id="${id}">قبول</button>
          <button class="icon-btn btn-warning" data-user-status="blocked" data-user-id="${id}">حظر</button>
          <button class="icon-btn btn-danger" data-delete-user="${id}">حذف</button>
        </div>
      </article>
    `).join("") : `<div class="empty-state">لا يوجد أعضاء حاليا</div>`}
  `;
}

function renderVideosPanel() {
  return `
    <form class="form-card" id="videoForm">
      <h2>إضافة فيديو</h2>
      <label>عنوان الفيديو</label><input id="videoTitle" required>
      <label>رابط YouTube أو Shorts</label><input id="videoUrl" dir="ltr" required>
      <label>القسم</label>${categorySelect("videoCategory")}
      <button class="btn btn-primary" type="submit">إضافة فيديو</button>
    </form>
    ${renderList(state.videos, "video")}
  `;
}

function renderPdfsPanel() {
  return `
    <form class="form-card" id="pdfForm">
      <h2>إضافة PDF</h2>
      <label>عنوان الملف</label><input id="pdfTitle" required>
      <label>رابط الملف</label><input id="pdfUrl" dir="ltr" required>
      <label>القسم</label>${categorySelect("pdfCategory")}
      <button class="btn btn-primary" type="submit">إضافة PDF</button>
    </form>
    ${renderList(state.pdfs, "pdf")}
  `;
}

function renderAnnouncementsPanel() {
  return `
    <form class="form-card" id="announcementForm">
      <h2>إضافة إعلان</h2>
      <label>عنوان الإعلان</label><input id="announcementTitle" required>
      <label>نص الإعلان</label><textarea id="announcementText" rows="4" required></textarea>
      <label>روابط صور الإعلان (اختياري - كل رابط في سطر منفصل)</label><textarea id="announcementImages" rows="5" dir="ltr" placeholder="https://example.com/image-1.jpg&#10;https://example.com/image-2.jpg"></textarea>
      <label>رابط فيديو YouTube (اختياري - يعمل تلقائيا ويكرر نفسه)</label><input id="announcementYoutube" dir="ltr" placeholder="https://www.youtube.com/watch?v=...">
      <button class="btn btn-primary" type="submit">إضافة إعلان</button>
    </form>
    ${renderList(state.announcements, "announcement")}
  `;
}

function renderSchedulesPanel() {
  return `
    <form class="form-card" id="scheduleForm">
      <h2>إضافة جدول كورس</h2>
      <label>اسم الكورس</label><input id="scheduleTitle" required>
      <label>نص/وصف الجدول</label><textarea id="scheduleDescription" rows="3"></textarea>
      <label>رابط الصورة</label><input id="scheduleImage" dir="ltr">
      <div class="form-row">
        <div><label>من</label><input id="scheduleFrom" required></div>
        <div><label>إلى</label><input id="scheduleTo" required></div>
      </div>
      <button class="btn btn-primary" type="submit">إضافة جدول</button>
    </form>
    ${renderList(state.schedules, "schedule")}
  `;
}

function renderSettingsPanel() {
  return `
    <form class="form-card" id="settingsForm">
      <h2>إعدادات المنصة</h2>
      <label>عن المنصة</label><textarea id="settingsAbout" rows="5">${escapeHtml(state.settings.aboutText || "")}</textarea>
      <label>تواصل معنا</label><textarea id="settingsContact" rows="5">${escapeHtml(state.settings.contactText || "")}</textarea>
      <label>رابط خلفية المنصة</label><input id="settingsBackground" dir="ltr" value="${escapeHtml(state.settings.backgroundUrl || "")}">
      <label>رابط فيديو YouTube للخلفية (يعمل تلقائيا ويكرر نفسه)</label><input id="settingsBackgroundYoutube" dir="ltr" value="${escapeHtml(state.settings.backgroundYoutubeUrl || "")}" placeholder="https://www.youtube.com/watch?v=...">
      <button class="btn btn-primary" type="submit">حفظ التعديلات</button>
    </form>
  `;
}

function categorySelect(id) {
  return `<select id="${id}">${CATEGORIES.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join("")}</select>`;
}

function renderList(data, type) {
  const entries = sortedEntries(data);
  if (!entries.length) return `<div class="empty-state">لا توجد عناصر حاليا</div>`;
  return `<div class="content-grid">${entries.map(([id, item]) => `
    <article class="item-card">
      ${type === "announcement" ? announcementImagesHtml(item.imageUrls || item.imageUrl) : item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ""}
      <h3>${escapeHtml(item.title || item.courseTitle || "عنصر")}</h3>
      <p>${escapeHtml(item.text || item.description || item.url || "")}</p>
      <div class="card-actions"><button class="icon-btn btn-danger" data-delete-type="${type}" data-delete-id="${id}">حذف</button></div>
    </article>
  `).join("")}</div>`;
}

function bindAdminForms() {
  const videoForm = $("#videoForm");
  if (videoForm) videoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = { title: $("#videoTitle").value.trim(), url: $("#videoUrl").value.trim(), category: $("#videoCategory").value, createdAt: new Date().toISOString() };
    await set(push(ref(db, "videos")), data);
    await sendTelegramMessage(`تم إضافة فيديو جديد\n${data.title}\nالقسم: ${categoryName(data.category)}`);
    videoForm.reset();
  });

  const pdfForm = $("#pdfForm");
  if (pdfForm) pdfForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = { title: $("#pdfTitle").value.trim(), url: $("#pdfUrl").value.trim(), category: $("#pdfCategory").value, createdAt: new Date().toISOString() };
    await set(push(ref(db, "pdfs")), data);
    await sendTelegramMessage(`تم إضافة ملف PDF جديد\n${data.title}\nالقسم: ${categoryName(data.category)}`);
    pdfForm.reset();
  });

  const announcementForm = $("#announcementForm");
  if (announcementForm) announcementForm.addEventListener("submit", async e => {
    e.preventDefault();
    const images = imageList($("#announcementImages").value);
    const data = { title: $("#announcementTitle").value.trim(), text: $("#announcementText").value.trim(), imageUrl: images[0] || "", imageUrls: images, youtubeUrl: $("#announcementYoutube").value.trim(), createdAt: new Date().toISOString() };
    await set(push(ref(db, "announcements")), data);
    await sendTelegramMessage(`تم إضافة إعلان جديد\n${data.title}\n${data.text}`);
    announcementForm.reset();
  });

  const scheduleForm = $("#scheduleForm");
  if (scheduleForm) scheduleForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = { courseTitle: $("#scheduleTitle").value.trim(), description: $("#scheduleDescription").value.trim(), imageUrl: $("#scheduleImage").value.trim(), dateFrom: $("#scheduleFrom").value.trim(), dateTo: $("#scheduleTo").value.trim(), createdAt: new Date().toISOString() };
    await set(push(ref(db, "schedules")), data);
    await sendTelegramMessage(`تم إضافة جدول كورس جديد\n${data.courseTitle}\nمن ${data.dateFrom} إلى ${data.dateTo}`);
    scheduleForm.reset();
  });

  const settingsForm = $("#settingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", async e => {
    e.preventDefault();
    await set(ref(db, "settings"), { aboutText: $("#settingsAbout").value, contactText: $("#settingsContact").value, backgroundUrl: $("#settingsBackground").value, backgroundYoutubeUrl: $("#settingsBackgroundYoutube").value.trim() });
    alert("تم حفظ الإعدادات بنجاح");
  });

  $$('[data-user-status]').forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.userId;
    const status = btn.dataset.userStatus;
    await update(ref(db, `users/${id}`), { status });
    const user = state.users[id];
    await sendTelegramMessage(`تم تحديث حالة العضو\n${user.fullName}\nالحالة: ${status}`);
  }));

  $$('[data-delete-user]').forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.deleteUser;
    if (!confirm("هل تريد حذف هذا العضو؟")) return;
    await remove(ref(db, `users/${id}`));
  }));

  $$('[data-delete-type]').forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("هل تريد حذف هذا العنصر؟")) return;
    const map = { video: "videos", pdf: "pdfs", announcement: "announcements", schedule: "schedules" };
    await remove(ref(db, `${map[btn.dataset.deleteType]}/${btn.dataset.deleteId}`));
  }));
}

function setupEvents() {
  $("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  $("#loginNavBtn").addEventListener("click", () => openAuth("login"));
  $("#logoutBtn").addEventListener("click", logout);
  $$('[data-open-auth]').forEach(btn => btn.addEventListener("click", () => openAuth(btn.dataset.openAuth)));
  $("#showLogin").addEventListener("click", () => openAuth("login"));
  $("#showRegister").addEventListener("click", () => openAuth("register"));
  $("#closeAnnouncementModal").addEventListener("click", closeAnnouncementModal);
  $("#modalOkBtn").addEventListener("click", closeAnnouncementModal);

  document.addEventListener("click", event => {
    const button = event.target.closest(".youtube-fullscreen-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggleYoutubeFullscreen(button);
  }, true);

  document.addEventListener("click", event => {
    const button = event.target.closest(".youtube-play-btn");
    const blocker = event.target.closest(".youtube-share-blocker");
    if (!button && !blocker) return;
    event.preventDefault();
    event.stopPropagation();
    const playButton = button || blocker.closest(".youtube-player-wrap")?.querySelector(".youtube-play-btn");
    if (playButton) toggleYoutubePlayback(playButton);
  }, true);

  $$(".nav a, .brand").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    const route = link.dataset.route || "home";
    if (route === "student" && (!state.currentUser || state.currentUser.status !== "approved")) return openAuth("login");
    if (route === "admin" && !state.isAdmin) return goTo("home", { replace: true });
    goTo(route, route === "home" ? { replace: true } : {});
  }));

  $$(".content-tab").forEach(btn => btn.addEventListener("click", () => {
    state.activeStudentTab = btn.dataset.tab;
    renderStudentContent();
  }));

  $$(".admin-tab").forEach(btn => btn.addEventListener("click", () => {
    state.activeAdminTab = btn.dataset.adminTab;
    renderAdminContent();
  }));

  $("#registerForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await registerUser({
        fullName: $("#regFullName").value.trim(),
        nationalId: $("#regNationalId").value.trim(),
        phone: $("#regPhone").value.trim(),
        email: $("#regEmail").value.trim(),
        password: $("#regPassword").value
      });
      $("#registerForm").reset();
      openAuth("login");
      showMessage("تم التسجيل بنجاح، انتظر موافقة الأدمن", "success");
    } catch (error) {
      showMessage(error.message || "حدث خطأ أثناء التسجيل", "error");
    }
  });

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await loginUser($("#loginEmail").value.trim(), $("#loginPassword").value);
      $("#loginForm").reset();
      clearMessage();
    } catch (error) {
      showMessage(error.message || "حدث خطأ أثناء تسجيل الدخول", "error");
    }
  });

  $("#studentContent").addEventListener("click", event => {
    const card = event.target.closest("[data-open-announcement]");
    if (!card) return;
    openAnnouncementByTitle(card.dataset.openAnnouncement);
  });

  $("#latestAnnouncement").addEventListener("click", event => {
    const card = event.target.closest("[data-open-announcement]");
    if (!card) return;
    openAnnouncementByTitle(card.dataset.openAnnouncement);
  });
}

function init() {
  loadSession();
  setupEvents();
  window.addEventListener("popstate", routeFromHash);
  window.addEventListener("hashchange", routeFromHash);
  setupRealtimeListeners();
  renderHome();
  updateNav();
  routeFromHash();
}

init();
