// =====================================================
// Life updates: loads your posts from the Google Sheet behind your Google Form
// =====================================================

// Your "life-updates" Supabase helper, which fetches the Google Sheet for this page.
// (The Sheet's own link lives inside that helper.)
const NOW_SHEET_URL = "https://tkkzlsuixkkbsulrdwci.supabase.co/functions/v1/life-updates";

// How many posts show at first, and how many more each "older updates" click adds
const NOW_PAGE_SIZE = 5;

// Posts longer than this get cut off with a "keep reading" button
const NOW_PREVIEW_CHARS = 300;

const nowFeed = document.getElementById("now-feed");

let allPosts = [];    // every post, newest first
let shownCount = 0;   // how many are on the page right now


// ---------- Load ----------

// Download the Sheet with a plain request, then let PapaParse read it
fetch(NOW_SHEET_URL)
  .then(response => {
    if (!response.ok) throw new Error("Google said " + response.status);
    return response.text();
  })
  .then(csvText => {
    const results = Papa.parse(csvText, {
      header: true,          // so each row's columns have names: row.Timestamp, row.Post
      skipEmptyLines: true
    });

    allPosts = results.data
      .filter(row => row.Post && row.Post.trim() !== "")
      .map(row => ({ text: row.Post.trim(), date: new Date(row.Timestamp), raw: row.Timestamp }))
      .sort((a, b) => (b.date || 0) - (a.date || 0));

    nowFeed.innerHTML = "";

    if (allPosts.length === 0) {
      nowFeed.textContent = "nothing here yet.";
      return;
    }

    showMore();
  })
  .catch(error => {
    console.error("Life updates:", error);
    nowFeed.textContent = "couldn't load updates right now.";
  });


// ---------- Showing posts, a few at a time ----------

function showMore() {
  // Remove the old "older updates" button; we'll add a fresh one at the bottom
  const oldButton = nowFeed.querySelector(".older-btn");
  if (oldButton) oldButton.remove();

  const next = allPosts.slice(shownCount, shownCount + NOW_PAGE_SIZE);
  next.forEach(post => nowFeed.append(buildPost(post)));
  shownCount += next.length;

  const left = allPosts.length - shownCount;
  if (left > 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "older-btn";
    button.innerHTML = '<span class="wiggle-arrow" aria-hidden="true">⌄</span> dig up older updates (' + left + ")";
    button.addEventListener("click", showMore);
    nowFeed.append(button);
  }
}

function buildPost(post) {
  const article = document.createElement("article");
  article.className = "now-entry";

  // The date
  const time = document.createElement("time");
  if (isNaN(post.date)) {
    time.textContent = post.raw;
  } else {
    time.dateTime = post.date.toISOString();
    time.textContent = post.date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    }).toLowerCase();   // "november 19, 2026"
  }

  // The text (shown exactly as typed, never as code)
  const text = document.createElement("p");
  article.append(time, text);

  if (post.text.length <= NOW_PREVIEW_CHARS) {
    text.textContent = post.text;
    return article;
  }

  // Long post: show a preview and a "keep reading" toggle
  const preview = shorten(post.text, NOW_PREVIEW_CHARS);
  text.textContent = preview;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "read-more-btn";
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<span class="wiggle-arrow" aria-hidden="true">⌄</span> keep reading';

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    text.textContent = open ? preview : post.text;
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.innerHTML = open
      ? '<span class="wiggle-arrow" aria-hidden="true">⌄</span> keep reading'
      : '<span class="wiggle-arrow" aria-hidden="true">⌃</span> fold it back up';
  });

  article.append(toggle);
  return article;
}

// Cuts text to about `limit` characters, ending on a whole word
function shorten(text, limit) {
  let cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > limit * 0.8) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s.,;:!?-]+$/, "") + "…";
}