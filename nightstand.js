// =====================================================
// On my nightstand: what Ty's reading and loves (Goodreads) and watching (Letterboxd)
// =====================================================

const NIGHTSTAND_URL = "https://tkkzlsuixkkbsulrdwci.supabase.co/functions/v1/nightstand";

const nightstand = document.getElementById("nightstand");

// "see more" links (your public profiles)
const GOODREADS_PAGE = "https://www.goodreads.com/user/show/93626231-ty";
const LETTERBOXD_PAGE = "https://letterboxd.com/semperty/";

fetch(NIGHTSTAND_URL)
  .then(response => response.json())
  .then(data => {
    if (!data.ok) throw new Error("nightstand helper said no");

    nightstand.innerHTML = "";
    addShelf("currently reading", data.reading, "book", false, null);
    addShelf("all-time favorites", data.favorites, "book", false, { text: "more on goodreads", url: GOODREADS_PAGE });
    addShelf("recently watched", data.watched, "film", true, { text: "more on letterboxd", url: LETTERBOXD_PAGE });

    // Nothing at all? Hide the whole section, heading included
    if (!nightstand.children.length) hideSection();
  })
  .catch(error => {
    console.error("Nightstand:", error);
    hideSection();
  });


// One group, e.g. "recently watched" with a row of posters
function addShelf(label, list, kind, showRating, more) {
  if (!list || list.length === 0) return;

  const group = document.createElement("div");
  group.className = "nightstand-group";

  // Heading, with an optional "more on ..." link beside it
  const header = document.createElement("div");
  header.className = "nightstand-header";

  const heading = document.createElement("h3");
  heading.textContent = label;
  header.append(heading);

  if (more) {
    const link = document.createElement("a");
    link.className = "nightstand-more";
    link.href = more.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = more.text + " ↗";
    header.append(link);
  }

  const row = document.createElement("div");
  row.className = "nightstand-row";
  list.forEach(item => row.append(buildCard(item, kind, showRating)));

  group.append(header, row);
  nightstand.append(group);
}

function buildCard(item, kind, showRating) {
  const card = document.createElement(item.url ? "a" : "div");
  card.className = "nightstand-card " + kind;
  if (item.url) {
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noopener";
  }

  // Cover or poster (or a plain colored block if there isn't one)
  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = "";
    img.loading = "lazy";
    card.append(img);
  } else {
    const blank = document.createElement("span");
    blank.className = "no-cover";
    blank.textContent = kind === "film" ? "🎬" : "📖";
    card.append(blank);
  }

  // Title, then the author or year, then stars
  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = item.title;
  card.append(title);

  // The author or year shows when you hover over the cover
  const detail = kind === "film"
    ? [item.year, item.rewatch ? "rewatch" : ""].filter(Boolean).join(" · ")
    : item.author || "";
  card.title = item.title + (detail ? " — " + detail : "");

  if (showRating && item.rating > 0) {
    const stars = document.createElement("span");
    stars.className = "card-stars";
    stars.textContent = starText(item.rating);
    stars.setAttribute("aria-label", item.rating + " out of 5 stars");
    card.append(stars);
  }

  return card;
}

// 4.5 → "★★★★½"
function starText(rating) {
  const whole = Math.floor(rating);
  return "★".repeat(whole) + (rating - whole >= 0.5 ? "½" : "");
}

function hideSection() {
  const section = nightstand.closest("section") || nightstand;
  section.hidden = true;
}