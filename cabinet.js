// =====================================================
// The curiosity cabinet: today's exhibit, the drawers,
// one draw a day, and collector codes with a shelf
// =====================================================

const CABINET_URL = "https://tkkzlsuixkkbsulrdwci.supabase.co/functions/v1/cabinet";

// Your drawers, in the order they appear, with a little icon and blurb.
// A drawer name you add later in your Form shows up automatically (with a 🗄️).
const DRAWERS = [
  { name: "curious & curious-er", icon: "🔍", blurb: "fun facts, history, unexpected science" },
  { name: "rabbit hole",          icon: "🕳️", blurb: "links worth clicking" },
  { name: "giggle drawer",        icon: "😂", blurb: "memes, jokes & silliness" },
  { name: "a note from me",       icon: "💌", blurb: "exactly what it sounds like" },
  { name: "eye candy",            icon: "🌸", blurb: "pretty things" },
  { name: "time capsule",         icon: "📼", blurb: "nostalgia & internet history" },
  { name: "thinking corner",      icon: "💭", blurb: "ideas that make you stop & think" }
];

const exhibitBox = document.getElementById("exhibit");
const drawersBox = document.getElementById("cabinet-drawers");
const resultBox = document.getElementById("cabinet-result");
const collectorBox = document.getElementById("collector");

let state = { total: 0, drawers: [], collector: null };


// =====================================================
// Loading
// =====================================================

async function loadCabinet() {
  const code = savedCode();
  try {
    const response = await fetch(CABINET_URL + (code ? "?code=" + encodeURIComponent(code) : ""));
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);

    // A saved code that no longer exists? Forget it.
    if (code && !data.collector) forgetCode();

    state = data;
    showExhibit(data.exhibit);
    showDrawers(data.drawers);
    showCollector();

    // Already opened a drawer today? Show it again.
    const todays = data.collector ? data.collector.todayDraw : savedTodayDraw();
    if (todays) showResult(todays, true);
  } catch (error) {
    console.error("Cabinet:", error);
    drawersBox.innerHTML = '<p class="cabinet-loading">the cabinet is stuck shut right now. try again later!</p>';
  }
}


// =====================================================
// Today's exhibit
// =====================================================

function showExhibit(item) {
  if (!item) { exhibitBox.hidden = true; return; }
  exhibitBox.hidden = false;
  exhibitBox.replaceChildren(label("today's exhibit"), buildItem(item));
}


// =====================================================
// The drawers
// =====================================================

function showDrawers(counts) {
  drawersBox.innerHTML = "";
  const known = new Map(counts.map(d => [d.name, d.count]));

  // Your drawers in order, then any new ones from the Sheet
  const names = DRAWERS.map(d => d.name).filter(n => known.has(n))
    .concat([...known.keys()].filter(n => !DRAWERS.some(d => d.name === n)));

  if (names.length === 0) {
    drawersBox.innerHTML = '<p class="cabinet-loading">the cabinet is empty… for now.</p>';
    return;
  }

  names.forEach(name => {
    const meta = drawerMeta(name);
    const drawer = document.createElement("button");
    drawer.type = "button";
    drawer.className = "drawer";
    drawer.dataset.drawer = name;

    const plate = document.createElement("span");
    plate.className = "drawer-plate";

    const title = document.createElement("span");
    title.className = "drawer-name";
    title.textContent = meta.icon + " " + name;

    const blurb = document.createElement("span");
    blurb.className = "drawer-blurb";
    blurb.textContent = meta.blurb;

    const knob = document.createElement("span");
    knob.className = "drawer-knob";
    knob.setAttribute("aria-hidden", "true");

    plate.append(title, blurb);
    drawer.append(plate, knob);
    drawer.addEventListener("click", () => openDrawer(name, drawer));
    drawersBox.append(drawer);
  });
}

async function openDrawer(name, drawerButton) {
  // One draw a day
  const already = state.collector ? state.collector.todayDraw : savedTodayDraw();
  if (already) {
    showResult(already, true);
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  drawerButton.classList.add("is-opening");
  drawersBox.classList.add("is-busy");

  try {
    const response = await fetch(CABINET_URL + "/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drawer: name, code: savedCode() || undefined })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);

    // Remember today's draw
    if (state.collector) {
      state.collector.todayDraw = data.item;
      if (!data.already && !data.repeat) {
        state.collector.shelf.unshift({ ...data.item, drawnOn: todayET() });
        state.collector.found += 1;
      }
      showCollector();
    } else {
      try { localStorage.setItem("cabinet-draw", JSON.stringify({ day: todayET(), item: data.item })); } catch {}
    }

    showResult(data.item, data.already);
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    resultBox.hidden = false;
    resultBox.replaceChildren(label("hmm"), textLine(error.message || "the drawer's stuck. try again!"));
  } finally {
    drawerButton.classList.remove("is-opening");
    drawersBox.classList.remove("is-busy");
  }
}

function showResult(item, isRepeatVisit) {
  resultBox.hidden = false;
  const heading = label(isRepeatVisit ? "today's find (come back tomorrow for another!)" : "you found…");
  resultBox.replaceChildren(heading, buildItem(item));

  // Mark which drawer it came from
  drawersBox.querySelectorAll(".drawer").forEach(d => {
    d.classList.toggle("is-open", d.dataset.drawer === item.drawer);
  });
}


// =====================================================
// Collector codes and the shelf
// =====================================================

function showCollector() {
  collectorBox.innerHTML = "";
  const c = state.collector;

  if (!c) {
    collectorBox.append(collectorSignup());
    return;
  }

  // Header: code + progress
  const header = document.createElement("div");
  header.className = "collector-header";

  const who = document.createElement("p");
  who.className = "collector-who";
  who.textContent = "🗝️ collector: " + c.code;

  const progress = document.createElement("p");
  progress.className = "collector-progress";
  progress.textContent = "you've found " + c.found + " of " + state.total + " curiosities";

  const forget = document.createElement("button");
  forget.type = "button";
  forget.className = "link-btn";
  forget.textContent = "not you? switch codes";
  forget.addEventListener("click", () => {
    forgetCode();
    state.collector = null;
    resultBox.hidden = true;
    drawersBox.querySelectorAll(".drawer").forEach(d => d.classList.remove("is-open"));
    showCollector();
    const todays = savedTodayDraw();
    if (todays) showResult(todays, true);
  });

  header.append(who, progress, forget);

  // The shelf: every find, newest first, each one opens up
  const shelf = document.createElement("div");
  shelf.className = "shelf";

  if (c.shelf.length === 0) {
    shelf.append(textLine("your shelf is empty. open a drawer to start your collection!"));
  }

  c.shelf.forEach(item => {
    const entry = document.createElement("details");
    entry.className = "shelf-item";

    const summary = document.createElement("summary");
    const meta = drawerMeta(item.drawer);
    summary.textContent = meta.icon + " " + shelfPreview(item);

    entry.append(summary, buildItem(item));
    shelf.append(entry);
  });

  collectorBox.append(header, shelf);
}

// The "start a collection" / "i already have a code" box
function collectorSignup() {
  const box = document.createElement("div");
  box.className = "collector-signup";

  const intro = document.createElement("p");
  intro.className = "collector-intro";
  intro.textContent = "🗝️ want to keep what you find? make a collector code (like a username, no password) and everything you draw lands on your own shelf, on any device.";

  const form = document.createElement("form");
  form.className = "collector-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "pick a username, make it unique :)";
  input.maxLength = 20;
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "collector code");

  const startBtn = document.createElement("button");
  startBtn.type = "submit";
  startBtn.className = "cartoon-btn btn-coral";
  startBtn.textContent = "start my collection";

  const haveBtn = document.createElement("button");
  haveBtn.type = "button";
  haveBtn.className = "cartoon-btn btn-plain";
  haveBtn.textContent = "i already have one";

  const status = document.createElement("p");
  status.className = "form-status";
  status.setAttribute("role", "status");

  // Start a new collection
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const code = input.value.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,20}$/.test(code)) {
      status.textContent = "codes are 3–20 characters: lowercase letters, numbers, - or _";
      return;
    }
    status.textContent = "checking…";
    try {
      const response = await fetch(CABINET_URL + "/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json();
      if (!data.ok) { status.textContent = data.error; return; }

      // Carry over today's draw from before they had a code? Not possible to save
      // it after the fact, so we just start fresh.
      saveCode(data.code);
      try { localStorage.removeItem("cabinet-draw"); } catch {}
      await loadCabinet();
    } catch {
      status.textContent = "couldn't reach the cabinet. try again!";
    }
  });

  // Use an existing code
  haveBtn.addEventListener("click", async () => {
    const code = input.value.trim().toLowerCase();
    if (!code) { status.textContent = "type your code in the box first"; input.focus(); return; }
    status.textContent = "looking for your shelf…";
    try {
      const response = await fetch(CABINET_URL + "?code=" + encodeURIComponent(code));
      const data = await response.json();
      if (!data.ok || !data.collector) { status.textContent = "couldn't find that code. double-check the spelling?"; return; }
      saveCode(data.collector.code);
      await loadCabinet();
    } catch {
      status.textContent = "couldn't reach the cabinet. try again!";
    }
  });

  const buttons = document.createElement("div");
  buttons.className = "collector-buttons";
  buttons.append(startBtn, haveBtn);

  form.append(input, buttons);
  box.append(intro, form, status);
  return box;
}


// =====================================================
// Building an item card (used for the exhibit, draws and the shelf)
// =====================================================

function buildItem(item) {
  const card = document.createElement("article");
  card.className = "curio";

  const meta = drawerMeta(item.drawer);
  const tag = document.createElement("span");
  tag.className = "curio-drawer";
  tag.textContent = meta.icon + " " + item.drawer;
  card.append(tag);

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.text ? item.text.slice(0, 100) : "a curiosity from the " + item.drawer + " drawer";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    card.append(img);
  }

  if (item.text) {
    const text = document.createElement("p");
    text.className = "curio-text";
    text.textContent = item.text;   // shown exactly as written, never as code
    card.append(text);
  }

  if (item.link) {
    const link = document.createElement("a");
    link.className = "curio-link";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = item.drawer === "rabbit hole" ? "follow the rabbit hole ↗" : "take a look ↗";
    card.append(link);
  }

  return card;
}


// =====================================================
// Small helpers
// =====================================================

function drawerMeta(name) {
  return DRAWERS.find(d => d.name === name) || { name, icon: "🗄️", blurb: "" };
}

function label(text) {
  const el = document.createElement("p");
  el.className = "cabinet-label";
  el.textContent = text;
  return el;
}

function textLine(text) {
  const el = document.createElement("p");
  el.className = "cabinet-loading";
  el.textContent = text;
  return el;
}

function shelfPreview(item) {
  const text = item.text || (item.image ? "a picture" : "a link");
  return text.length > 60 ? text.slice(0, 60).trimEnd() + "…" : text;
}

// "Today" in Eastern time, matching the helper (the day flips at midnight ET)
function todayET() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

// Browser storage can be unavailable (private windows); never let that break the page
function savedCode() {
  try { return localStorage.getItem("cabinet-code") || ""; } catch { return ""; }
}
function saveCode(code) {
  try { localStorage.setItem("cabinet-code", code); } catch {}
}
function forgetCode() {
  try { localStorage.removeItem("cabinet-code"); } catch {}
}
function savedTodayDraw() {
  try {
    const saved = JSON.parse(localStorage.getItem("cabinet-draw") || "null");
    return saved && saved.day === todayET() ? saved.item : null;
  } catch { return null; }
}


loadCabinet();