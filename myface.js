// =====================================================
// My Face: draws the corkboard and lets visitors pin a note
// =====================================================

// From Supabase → Project Settings → API Keys / Data API.
// URL: just the base address, ending in .supabase.co (no /rest/v1/).
// Key: the PUBLISHABLE (or "anon public") key. It's designed to be public;
// the security rules in the database protect your data.
// NEVER paste the "secret" or "service_role" key here.
const SUPABASE_URL = "https://tkkzlsuixkkbsulrdwci.supabase.co";
const SUPABASE_KEY = "sb_publishable_1X5OaMgcsyLurangmhxxNQ_qLRxJUXt";
const PHOTO_BUCKET = "myface-photos";
const PLAYLIST_ID = "7zKcvxlWwbhThio6C5ZrXa";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// The private helper that talks to Spotify for you
const MIXTAPE_URL = SUPABASE_URL + "/functions/v1/mixtape";

// One note AND one song per visitor every this many hours.
// Set to 0 while you're testing.
const LIMIT_HOURS = 24;

// How many "why" notes to show around the mixtape (newest first)
const MAX_WHY_NOTES = 8;

// ----- Page elements -----
const board = document.querySelector(".corkboard");

const openButton = document.getElementById("open-form-btn");
const addSongButton = document.getElementById("add-song-btn");
const dialog = document.getElementById("note-dialog");
const closeButton = document.getElementById("close-form-btn");
const form = document.getElementById("note-form");
const formTitle = document.getElementById("form-title");
const modeTabs = document.querySelectorAll(".mode-tab");
const nameInput = document.getElementById("note-name");
const noteLabel = document.getElementById("note-label");
const noteInput = document.getElementById("note-text");
const photoInput = document.getElementById("note-photo");
const songFields = document.querySelector(".song-fields");
const songTitleInput = document.getElementById("song-title");
const songArtistInput = document.getElementById("song-artist");
const submitButton = document.getElementById("place-btn");
const formStatus = document.getElementById("form-status");

const placeBar = document.getElementById("place-bar");
const pinButton = document.getElementById("pin-btn");
const editButton = document.getElementById("edit-btn");
const cancelButton = document.getElementById("cancel-btn");
const placeStatus = document.getElementById("place-status");

const mixtapeList = document.getElementById("mixtape-index");
const mixtapeStatus = document.getElementById("mixtape-status");
const whyLeft = document.getElementById("why-left");
const whyRight = document.getElementById("why-right");

let mode = "note";           // which tab the pop-up is on: "note" or "song"
let photoBlob = null;        // the visitor's photo, shrunk, ready to upload
let photoPreviewUrl = "";    // a temporary link to show it in the preview
let preview = null;          // the note they're placing before pinning it


// =====================================================
// Building notes
// =====================================================

// Makes a sticky note (no photo) or a polaroid (with photo) for the board
function buildPin(data) {
  let pin;

  if (data.imageUrl) {
    pin = document.createElement("figure");
    pin.className = "polaroid";

    const img = document.createElement("img");
    img.src = data.imageUrl;
    img.alt = "Photo from " + data.name;

    const caption = document.createElement("figcaption");
    caption.textContent = data.note;

    pin.append(img, caption, makeSignature(data.name));
  } else {
    pin = document.createElement("div");
    pin.className = "sticky-note note-" + data.color;

    const text = document.createElement("p");
    text.textContent = data.note;

    pin.append(text, makeSignature(data.name));
  }

  pin.style.setProperty("--x", data.x + "%");
  pin.style.setProperty("--y", data.y + "%");
  pin.style.setProperty("--tilt", data.tilt + "deg");
  return pin;
}

// Makes a "why" sticky note for beside the mixtape
function buildWhyNote(song) {
  const note = document.createElement("div");
  note.className = "sticky-note why-note note-" + song.color;

  const label = document.createElement("span");
  label.className = "why-song";
  label.textContent = song.title;

  const text = document.createElement("p");
  text.textContent = song.why;

  note.append(label, text, makeSignature(song.name));
  return note;
}

function makeSignature(name) {
  const signature = document.createElement("span");
  signature.className = "signature";
  signature.textContent = "— " + name;
  return signature;
}


// =====================================================
// Loading the board
// =====================================================

async function loadBoard() {
  const { data, error } = await db
    .from("notes")
    .select("*")
    .order("created_at", { ascending: true });   // oldest first, so newer notes land on top

  if (error) {
    placeStatus.textContent = "The board couldn't load: " + error.message;
    placeBar.hidden = false;
    pinButton.hidden = editButton.hidden = cancelButton.hidden = true;
    return;
  }

  data.forEach(row => {
    const pin = buildPin({
      name: row.name,
      note: row.note,
      color: row.color,
      imageUrl: row.image_path ? photoUrl(row.image_path) : "",
      x: row.x,
      y: row.y,
      tilt: row.tilt
    });
    // Keep a note that's being placed on top of everything
    if (preview) board.insertBefore(pin, preview);
    else board.append(pin);
  });
}

// Turns a stored file name into a link the browser can show
function photoUrl(path) {
  return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}


// =====================================================
// One note and one song per visit
// =====================================================

function usedRecently(kind) {
  if (LIMIT_HOURS === 0) return false;
  const last = Number(localStorage.getItem("myface-last-" + kind) || 0);
  return Date.now() - last < LIMIT_HOURS * 60 * 60 * 1000;
}

function markUsed(kind) {
  localStorage.setItem("myface-last-" + kind, String(Date.now()));
  updateButtons();
}

function updateButtons() {
  const noteDone = usedRecently("pin");
  const songDone = usedRecently("song");

  openButton.disabled = noteDone && songDone;
  openButton.textContent = openButton.disabled ? "📌 All done! Come back tomorrow" : "📌 Pin something";

  addSongButton.disabled = songDone;
  addSongButton.textContent = songDone ? "🎵 Song added! Come back tomorrow" : "🎵 Add a song";
}


// =====================================================
// The pop-up: Note and Song tabs
// =====================================================

function setMode(newMode) {
  mode = newMode;
  const isSong = mode === "song";

  modeTabs.forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  formTitle.textContent = isSong ? "Add a song to the mixtape" : "Pin something to the board";
  songFields.hidden = !isSong;
  document.querySelectorAll(".note-only").forEach(el => { el.hidden = isSong; });

  noteLabel.textContent = isSong ? "Why this song?" : "Your note";
  noteInput.placeholder = isSong ? "A memory, a mood, why it reminds you of me..." : "Say hi, share a memory, roast me...";
  noteInput.maxLength = isSong ? 200 : 280;
  submitButton.textContent = isSong ? "Add to the mixtape 🎵" : "Place it on the board →";

  // Already used today?
  const used = usedRecently(isSong ? "song" : "pin");
  submitButton.disabled = used;
  formStatus.textContent = used
    ? (isSong ? "You've already added a song today. Come back tomorrow!" : "You've already pinned a note today. Come back tomorrow!")
    : "";
}

modeTabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

function openForm(startMode) {
  setMode(startMode);
  dialog.showModal();
}

openButton.addEventListener("click", () => openForm(usedRecently("pin") ? "song" : "note"));
addSongButton.addEventListener("click", () => openForm("song"));
closeButton.addEventListener("click", () => dialog.close());

// Clicking the dark area outside the card closes it too
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  if (mode === "song") submitSong();
  else startPlacing();
});


// =====================================================
// Notes: photo, placing, dragging, pinning
// =====================================================

// Shrinks the photo so it uploads quickly (max 1200px on the long side).
// Redrawing it also strips hidden data like GPS location.
photoInput.addEventListener("change", () => {
  photoBlob = null;
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = "";

  const file = photoInput.files[0];
  if (!file) {
    if (preview) renderPreview();
    return;
  }

  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);

    canvas.toBlob(blob => {
      photoBlob = blob;
      photoPreviewUrl = URL.createObjectURL(blob);
      if (preview) renderPreview();   // update the preview if it's already out
    }, "image/jpeg", 0.85);
  };
  img.onerror = () => {
    formStatus.textContent = "That photo couldn't be opened. Try a JPG or PNG.";
    photoInput.value = "";
  };
  img.src = URL.createObjectURL(file);
});

function currentData() {
  return {
    name: nameInput.value.trim() || "Anonymous",
    note: noteInput.value.trim(),
    color: form.querySelector('input[name="color"]:checked').value,
    imageUrl: photoPreviewUrl
  };
}

// Draws (or redraws) the visitor's note on the board
function renderPreview() {
  const data = currentData();

  // Keep the spot and tilt if they've already placed it once
  if (preview) {
    data.x = parseFloat(preview.style.getPropertyValue("--x"));
    data.y = parseFloat(preview.style.getPropertyValue("--y"));
    data.tilt = parseFloat(preview.style.getPropertyValue("--tilt"));
    preview.remove();
  } else {
    data.x = 42;
    data.y = 35;
    data.tilt = Math.round(Math.random() * 12 - 6);   // -6 to 6 degrees
  }

  preview = buildPin(data);
  preview.classList.add("is-preview");
  makeDraggable(preview);
  board.append(preview);
}

// "Place it on the board": close the pop-up and let them drag
function startPlacing() {
  if (!noteInput.value.trim()) {
    formStatus.textContent = "Write a note first!";
    noteInput.focus();
    return;
  }
  formStatus.textContent = "";

  renderPreview();
  dialog.close();

  placeStatus.textContent = "Drag your note anywhere on the board, then pin it!";
  placeBar.hidden = false;
  board.scrollIntoView({ behavior: "smooth", block: "center" });
}

// "Edit": reopen the pop-up (the note stays where they put it)
editButton.addEventListener("click", () => openForm("note"));

// "Cancel": take the note back off the board
cancelButton.addEventListener("click", () => {
  if (preview) preview.remove();
  preview = null;
  placeBar.hidden = true;
});

function makeDraggable(el) {
  let startX, startY, startLeft, startTop;

  el.addEventListener("pointerdown", event => {
    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    el.classList.add("is-dragging");
    startX = event.clientX;
    startY = event.clientY;
    startLeft = el.offsetLeft;
    startTop = el.offsetTop;
  });

  el.addEventListener("pointermove", event => {
    if (!el.hasPointerCapture(event.pointerId)) return;

    const maxLeft = board.clientWidth - el.offsetWidth;
    const maxTop = board.clientHeight - el.offsetHeight;
    const left = Math.min(Math.max(startLeft + event.clientX - startX, 0), maxLeft);
    const top = Math.min(Math.max(startTop + event.clientY - startY, 0), maxTop);

    // Save as percentages so it lands in the same spot on any screen
    el.style.setProperty("--x", (left / board.clientWidth * 100).toFixed(2) + "%");
    el.style.setProperty("--y", (top / board.clientHeight * 100).toFixed(2) + "%");
  });

  el.addEventListener("pointerup", event => {
    el.releasePointerCapture(event.pointerId);
    el.classList.remove("is-dragging");
  });
}

pinButton.addEventListener("click", async () => {
  if (!preview) return;

  const data = currentData();
  pinButton.disabled = editButton.disabled = cancelButton.disabled = true;
  pinButton.textContent = "Pinning…";
  placeStatus.textContent = "";

  try {
    // 1. Upload the photo, if there is one
    let imagePath = null;
    if (photoBlob) {
      imagePath = randomId() + ".jpg";
      const { error: uploadError } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(imagePath, photoBlob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
    }

    // 2. Save the note
    const { error: insertError } = await db.from("notes").insert({
      name: data.name.slice(0, 40),
      note: data.note.slice(0, 280),
      color: data.color,
      image_path: imagePath,
      x: Math.round(parseFloat(preview.style.getPropertyValue("--x")) * 100) / 100,
      y: Math.round(parseFloat(preview.style.getPropertyValue("--y")) * 100) / 100,
      tilt: parseFloat(preview.style.getPropertyValue("--tilt"))
    });
    if (insertError) throw insertError;

    // 3. Lock the note in place on the board
    preview.classList.remove("is-preview");
    const pinned = preview.cloneNode(true);   // a copy without the drag listeners
    preview.replaceWith(pinned);
    preview = null;

    placeBar.hidden = true;
    noteInput.value = "";
    photoInput.value = "";
    photoBlob = null;
    photoPreviewUrl = "";
    markUsed("pin");
  } catch (error) {
    placeStatus.textContent = "Something went wrong: " + error.message;
  } finally {
    pinButton.disabled = editButton.disabled = cancelButton.disabled = false;
    pinButton.textContent = "📌 Pin it!";
  }
});

// A random, unguessable file name for each photo
function randomId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}


// =====================================================
// Songs: adding one, the "why" notes, the Mixtape Index
// =====================================================

let playlistSongs = [];   // what's on Spotify
let whyNotes = [];        // the notes friends left (newest first)

async function submitSong() {
  const title = songTitleInput.value.trim();
  const artist = songArtistInput.value.trim();
  const why = noteInput.value.trim();

  if (!title) {
    formStatus.textContent = "Which song?";
    songTitleInput.focus();
    return;
  }
  if (!why) {
    formStatus.textContent = "Tell us why you picked it!";
    noteInput.focus();
    return;
  }

  const name = nameInput.value.trim() || "Anonymous";
  const color = form.querySelector('input[name="color"]:checked').value;

  submitButton.disabled = true;
  submitButton.textContent = "Adding…";
  formStatus.textContent = "";

  try {
    const response = await fetch(MIXTAPE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist, name, why, color })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error);

    // Show it right away (the playlist list refreshes on its own later)
    playlistSongs.push(result.song);
    whyNotes.unshift({ ...result.note, title: result.song.title, track_uri: result.song.uri });
    renderMixtape();

    songTitleInput.value = "";
    songArtistInput.value = "";
    noteInput.value = "";
    dialog.close();
    markUsed("song");

    mixtapeStatus.textContent = "Added “" + result.song.title + "” by " + result.song.artist + "! 🎶";
    document.querySelector(".mixtape-area").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    formStatus.textContent = "Something went wrong: " + error.message;
  } finally {
    submitButton.disabled = usedRecently("song");
    submitButton.textContent = "Add to the mixtape 🎵";
  }
}

async function loadMixtape() {
  // Get the playlist (from the helper) and the why notes (from Supabase) together
  const [playlist, notes] = await Promise.allSettled([
    fetch(MIXTAPE_URL).then(r => r.json()),
    db.from("songs").select("*").order("created_at", { ascending: false })
  ]);

  if (playlist.status === "fulfilled" && playlist.value.ok) {
    playlistSongs = playlist.value.songs;
  } else {
    playlistSongs = null;
    console.error("Mixtape:", playlist.reason || playlist.value.error);
  }

  if (notes.status === "fulfilled" && !notes.value.error) {
    whyNotes = notes.value.data;
  } else {
    console.error("Why notes:", notes.reason || notes.value.error);
  }

  renderMixtape();
}

function renderMixtape() {
  // ----- The "why" notes, alternating left and right -----
  whyLeft.innerHTML = "";
  whyRight.innerHTML = "";
  whyNotes.slice(0, MAX_WHY_NOTES).forEach((song, i) => {
    (i % 2 === 0 ? whyLeft : whyRight).append(buildWhyNote(song));
  });

  // ----- The Mixtape Index -----
  mixtapeList.innerHTML = "";

  if (playlistSongs === null) {
    mixtapeList.append(messageItem("The mixtape couldn't load right now."));
    return;
  }
  if (playlistSongs.length === 0) {
    mixtapeList.append(messageItem("The mixtape is empty. Add the first song!"));
    return;
  }

  // Who added each song through the site (by Spotify track)
  const addedBy = {};
  whyNotes.forEach(n => { if (!addedBy[n.track_uri]) addedBy[n.track_uri] = n.name; });

  playlistSongs.forEach(song => {
    const item = document.createElement("li");

    const title = document.createElement(song.url ? "a" : "span");
    title.className = "song";
    title.textContent = song.title;
    if (song.url) {
      title.href = song.url;
      title.target = "_blank";
      title.rel = "noopener";
    }

    const artist = document.createElement("span");
    artist.className = "artist";
    artist.textContent = " — " + song.artist;

    item.append(title, artist);

    if (addedBy[song.uri]) {
      const via = document.createElement("span");
      via.className = "added-by";
      via.textContent = "via " + addedBy[song.uri];
      item.append(via);
    }

    mixtapeList.append(item);
  });
}

function messageItem(text) {
  const item = document.createElement("li");
  item.className = "mixtape-loading";
  item.textContent = text;
  return item;
}


// =====================================================
// The cassette player (in the navbar)
// =====================================================

const cassette = document.getElementById("cassette");
const cassetteIcon = document.getElementById("cassette-icon");
let spotifyPlayer = null;   // Spotify's controller, once it's ready

function showPlaying(isPlaying) {
  cassette.classList.toggle("is-playing", isPlaying);
  cassette.setAttribute("aria-pressed", String(isPlaying));
  const label = isPlaying ? "Pause the mixtape" : "Play the mixtape";
  cassette.setAttribute("aria-label", label);
  cassette.title = label;
  cassetteIcon.textContent = isPlaying ? "❚❚" : "▶";
}

// Spotify's script calls this when it's loaded
window.onSpotifyIframeApiReady = IFrameAPI => {
  const options = {
    uri: "spotify:playlist:" + PLAYLIST_ID,
    width: "100%",
    height: 352          // the full-size player
  };

  IFrameAPI.createController(document.getElementById("spotify-embed"), options, controller => {
    spotifyPlayer = controller;

    // Keep the reels in sync, even when someone uses Spotify's own buttons
    controller.addListener("playback_update", event => {
      showPlaying(!event.data.isPaused);
    });
  });
};

cassette.addEventListener("click", () => {
  if (spotifyPlayer) {
    spotifyPlayer.togglePlay();
    showPlaying(!cassette.classList.contains("is-playing"));   // react right away
  } else {
    // Spotify's player didn't load (blocked or offline): open the playlist instead
    window.open("https://open.spotify.com/playlist/" + PLAYLIST_ID, "_blank", "noopener");
  }
});


// =====================================================
// Start
// =====================================================

updateButtons();
loadBoard();
loadMixtape();