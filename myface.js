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

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// One pin per visitor every this many hours. Set to 0 while you're testing.
const LIMIT_HOURS = 24;

// The board
const board = document.querySelector(".corkboard");

// The pop-up form
const openButton = document.getElementById("open-form-btn");
const dialog = document.getElementById("note-dialog");
const closeButton = document.getElementById("close-form-btn");
const form = document.getElementById("note-form");
const nameInput = document.getElementById("note-name");
const noteInput = document.getElementById("note-text");
const photoInput = document.getElementById("note-photo");
const formStatus = document.getElementById("form-status");

// The bar that shows while someone is placing their note
const placeBar = document.getElementById("place-bar");
const pinButton = document.getElementById("pin-btn");
const editButton = document.getElementById("edit-btn");
const cancelButton = document.getElementById("cancel-btn");
const placeStatus = document.getElementById("place-status");

let photoBlob = null;      // the visitor's photo, shrunk, ready to upload
let photoPreviewUrl = "";  // a temporary link to show it in the preview
let preview = null;        // the note they're placing before pinning it


// ---------- Building a note ----------

// Makes a sticky note (no photo) or a polaroid (with photo)
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

function makeSignature(name) {
  const signature = document.createElement("span");
  signature.className = "signature";
  signature.textContent = "— " + name;
  return signature;
}


// ---------- Loading the board ----------

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


// ---------- One pin per visit ----------

function hasPinnedRecently() {
  if (LIMIT_HOURS === 0) return false;
  const last = Number(localStorage.getItem("myface-last-pin") || 0);
  return Date.now() - last < LIMIT_HOURS * 60 * 60 * 1000;
}

function markDone() {
  openButton.disabled = true;
  openButton.textContent = "📌 Pinned! Come back tomorrow";
}


// ---------- Opening and closing the pop-up ----------

openButton.addEventListener("click", () => dialog.showModal());
closeButton.addEventListener("click", () => dialog.close());

// Clicking the dark area outside the card closes it too
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});


// ---------- The photo ----------

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


// ---------- Placing the preview ----------

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
form.addEventListener("submit", event => {
  event.preventDefault();
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
});

// "Edit": reopen the pop-up (the note stays where they put it)
editButton.addEventListener("click", () => dialog.showModal());

// "Cancel": take the note back off the board
cancelButton.addEventListener("click", () => {
  if (preview) preview.remove();
  preview = null;
  placeBar.hidden = true;
});


// ---------- Dragging ----------

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


// ---------- Pinning (saving) ----------

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
    form.reset();
    localStorage.setItem("myface-last-pin", String(Date.now()));
    markDone();
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


// ---------- Start ----------

if (hasPinnedRecently()) markDone();
loadBoard();