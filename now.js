// =====================================================
// Now: loads your updates from the Google Sheet behind your Google Form
// =====================================================

// Your "life-updates" Supabase helper, which fetches the Google Sheet for this page.
// (The Sheet's own link lives inside that helper.)
const NOW_SHEET_URL = "https://tkkzlsuixkkbsulrdwci.supabase.co/functions/v1/life-updates";

// How many updates to show (newest first). Set to 0 to show all of them.
const NOW_MAX_POSTS = 10;

const nowFeed = document.getElementById("now-feed");

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
    showPosts(results.data);
  })
  .catch(error => {
    console.error("Life updates:", error);
    nowFeed.textContent = "couldn't load updates right now.";
  });

function showPosts(rows) {
  // Keep rows that have a post, newest first
  let posts = rows
    .filter(row => row.Post && row.Post.trim() !== "")
    .map(row => ({ text: row.Post.trim(), date: new Date(row.Timestamp), raw: row.Timestamp }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));

  if (NOW_MAX_POSTS > 0) posts = posts.slice(0, NOW_MAX_POSTS);

  nowFeed.innerHTML = "";

  if (posts.length === 0) {
    nowFeed.textContent = "nothing here yet.";
    return;
  }

  posts.forEach(post => {
    const article = document.createElement("article");
    article.className = "now-entry";

    const time = document.createElement("time");
    if (isNaN(post.date)) {
      time.textContent = post.raw;
    } else {
      time.dateTime = post.date.toISOString();
      time.textContent = post.date.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
      }).toLowerCase();   // "november 19, 2026"
    }

    const text = document.createElement("p");
    text.textContent = post.text;   // shown exactly as typed, never as code

    article.append(time, text);
    nowFeed.append(article);
  });
}