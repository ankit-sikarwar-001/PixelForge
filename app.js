const $ = (s) => document.querySelector(s);

const state = {
  file: null,
  image: null,
  resultBlob: null,
  mode: "dimensions",
  originalWidth: 0,
  originalHeight: 0
};

const dropzone = $("#dropzone");
const fileInput = $("#fileInput");

$("#browseBtn").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => e.target.files[0] && loadFile(e.target.files[0]));

["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault(); dropzone.classList.add("drag");
}));
["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault(); dropzone.classList.remove("drag");
}));
dropzone.addEventListener("drop", e => e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]));

function loadFile(file) {
  if (!file.type.startsWith("image/")) return setStatus("Please choose a valid image.", "error");
  state.file = file;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.originalWidth = img.naturalWidth;
    state.originalHeight = img.naturalHeight;
    $("#fileName").textContent = file.name;
    $("#originalPreview").src = url;
    $("#originalMeta").textContent = `${img.naturalWidth} × ${img.naturalHeight}px • ${formatBytes(file.size)}`;
    $("#widthInput").value = img.naturalWidth;
    $("#heightInput").value = img.naturalHeight;
    $("#workspace").classList.remove("hidden");
    $("#dropzone").classList.add("hidden");
    setStatus("Ready.", "success");
  };
  img.src = url;
}

document.querySelectorAll(".mode").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".mode").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  state.mode = btn.dataset.mode;
  $("#dimensionControls").classList.toggle("hidden", state.mode !== "dimensions");
  $("#fileSizeControls").classList.toggle("hidden", state.mode !== "filesize");
}));

$("#lockRatio").addEventListener("change", () => {});
$("#widthInput").addEventListener("input", () => {
  if (!$("#lockRatio").checked || !state.image) return;
  const w = Number($("#widthInput").value);
  if (w > 0) $("#heightInput").value = Math.round(w * state.originalHeight / state.originalWidth);
});
$("#heightInput").addEventListener("input", () => {
  if (!$("#lockRatio").checked || !state.image) return;
  const h = Number($("#heightInput").value);
  if (h > 0) $("#widthInput").value = Math.round(h * state.originalWidth / state.originalHeight);
});

$("#qualityInput").addEventListener("input", e => $("#qualityValue").textContent = `${e.target.value}%`);
$("#advancedBtn").addEventListener("click", () => {
  $("#advancedPanel").classList.toggle("hidden");
});

$("#processBtn").addEventListener("click", processImage);
$("#downloadBtn").addEventListener("click", downloadResult);
$("#resetBtn").addEventListener("click", resetApp);

async function processImage() {
  if (!state.image) return setStatus("Choose an image first.", "error");
  setStatus("Processing…");
  $("#processBtn").disabled = true;

  try {
    let result;
    if (state.mode === "filesize") {
      result = await makeTargetSize();
    } else {
      const w = Math.max(1, Number($("#widthInput").value));
      const h = Math.max(1, Number($("#heightInput").value));
      result = await renderCanvas(w, h, Number($("#qualityInput").value) / 100);
    }

    state.resultBlob = result.blob;
    $("#resultPreview").src = URL.createObjectURL(result.blob);
    $("#resultEmpty").classList.add("hidden");
    $("#resultMeta").textContent = `${result.width} × ${result.height}px • ${formatBytes(result.blob.size)}`;
    $("#downloadBtn").disabled = false;
    $("#downloadBtn").classList.remove("disabled");
    setStatus(`Done — ${formatBytes(state.file.size)} → ${formatBytes(result.blob.size)}`, "success");
  } catch (err) {
    setStatus(err.message || "Could not process the image.", "error");
  } finally {
    $("#processBtn").disabled = false;
  }
}

async function renderCanvas(width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: $("#formatSelect").value !== "image/jpeg" });
  if ($("#smoothScaling").checked) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  if ($("#formatSelect").value === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(state.image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, $("#formatSelect").value, quality);
  return { blob, width, height };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Browser could not encode this format.")), type, quality);
  });
}

async function makeTargetSize() {
  const target = Number($("#targetSize").value) * ($("#sizeUnit").value === "MB" ? 1024 * 1024 : 1024);
  if (!target || target < 100) throw new Error("Enter a realistic target size.");

  const format = $("#formatSelect").value;
  let width = state.originalWidth, height = state.originalHeight;
  let quality = Number($("#qualityInput").value) / 100;
  let best = null;

  // Binary-search quality first. If still too large, progressively scale dimensions.
  for (let dimensionPass = 0; dimensionPass < 8; dimensionPass++) {
    let low = 0.10, high = quality, candidate = null;
    for (let i = 0; i < 8; i++) {
      const q = (low + high) / 2;
      const r = await renderCanvas(width, height, q);
      if (r.blob.size <= target) { candidate = r; low = q; }
      else high = q;
    }
    if (candidate) {
      best = candidate;
      break;
    }
    width = Math.max(160, Math.floor(width * 0.82));
    height = Math.max(160, Math.floor(height * 0.82));
    quality = Math.min(quality, 0.82);
  }

  if (!best) throw new Error("Target is too small for this image. Try a larger target.");
  return best;
}

function downloadResult() {
  if (!state.resultBlob) return;
  const ext = $("#formatSelect").value.split("/")[1].replace("jpeg","jpg");
  const base = state.file.name.replace(/\.[^.]+$/, "");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(state.resultBlob);
  a.download = `${base}-pixelforge.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetApp() {
  state.file = null; state.image = null; state.resultBlob = null;
  $("#workspace").classList.add("hidden");
  $("#dropzone").classList.remove("hidden");
  $("#resultPreview").removeAttribute("src");
  $("#resultEmpty").classList.remove("hidden");
  $("#downloadBtn").disabled = true;
  $("#downloadBtn").classList.add("disabled");
  fileInput.value = "";
  setStatus("");
}

function setStatus(text, type = "") {
  const el = $("#status");
  el.textContent = text;
  el.className = `status ${type}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
