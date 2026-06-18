(function () {
  const root = document.getElementById("story-generator-root");
  if (!root) return;

  root.innerHTML = `
    <div id="story-generator-backdrop" class="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2900] hidden" aria-hidden="true"></div>
    <aside id="story-generator-sidebar" class="story-sidebar bg-[#0a0a0a] border-l border-[#222]" aria-hidden="true" aria-labelledby="story-generator-title">
      <button type="button" class="story-mobile-floating-close" data-story-close aria-label="Exit share image creator">
        <span>Exit</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      <div class="sticky top-0 z-10 bg-[#0a0a0a]/95 border-b border-[#222] px-6 py-4 flex justify-between items-center">
        <h2 id="story-generator-title" class="text-lg font-serif font-bold text-white tracking-wide">Create share image</h2>
        <button type="button" class="story-close-button" data-story-close aria-label="Close share image creator">
          <span class="story-close-label">Close</span>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="p-6 space-y-8 overflow-y-auto">
        <div class="space-y-3">
          <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Preview</label>
          <div class="w-full aspect-square bg-black border border-[#222] rounded-sm overflow-hidden">
            <canvas id="story-generator-canvas" class="w-full h-full object-contain"></canvas>
          </div>
        </div>
        <div class="space-y-6">
          <button type="button" id="story-generate-daily" class="w-full bg-[#151515] border border-[#222] hover:border-[#444] text-white text-xs font-bold py-3 uppercase tracking-widest transition">
            Generate daily update
          </button>
          <div class="space-y-2">
            <label for="story-image-url" class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Image URL</label>
            <input id="story-image-url" type="url" class="w-full bg-[#050505] border border-[#222] rounded-sm px-4 py-3 text-gray-300 text-xs focus:border-gray-500 outline-none transition">
          </div>
          <div class="space-y-2">
            <label for="story-headline" class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Headline</label>
            <textarea id="story-headline" rows="3" class="w-full bg-[#050505] border border-[#222] rounded-sm px-4 py-3 text-gray-300 text-xs focus:border-gray-500 outline-none transition"></textarea>
          </div>
          <div class="space-y-2">
            <label for="story-summary" class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Summary</label>
            <textarea id="story-summary" rows="5" class="w-full bg-[#050505] border border-[#222] rounded-sm px-4 py-3 text-gray-300 text-xs focus:border-gray-500 outline-none transition"></textarea>
          </div>
          <div class="space-y-2">
            <label for="story-date" class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</label>
            <input id="story-date" type="date" class="w-full bg-[#050505] border border-[#222] rounded-sm px-4 py-3 text-gray-300 text-xs focus:border-gray-500 outline-none transition">
          </div>
        </div>
        <div class="pt-4 sticky bottom-0 bg-[#0a0a0a] pb-6">
          <button type="button" id="story-share" class="w-full bg-[#8B0000] hover:bg-[#660000] text-white font-bold py-4 rounded-sm uppercase tracking-widest text-xs transition">Share or download story</button>
          <button type="button" class="story-mobile-exit w-full mt-3 border border-[#333] bg-[#111] hover:bg-[#171717] text-gray-300 hover:text-white font-bold py-3 rounded-sm uppercase tracking-widest text-[10px] transition" data-story-close>Close image creator</button>
        </div>
      </div>
    </aside>
  `;

  const backdrop = document.getElementById("story-generator-backdrop");
  const sidebar = document.getElementById("story-generator-sidebar");
  const canvas = document.getElementById("story-generator-canvas");
  const imageInput = document.getElementById("story-image-url");
  const titleInput = document.getElementById("story-headline");
  const summaryInput = document.getElementById("story-summary");
  const dateInput = document.getElementById("story-date");
  const context = canvas.getContext("2d");
  let drawSequence = 0;

  function close() {
    sidebar.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "true");
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("archive-overlay-open");
  }

  function open(detail) {
    titleInput.value = detail.title || "";
    summaryInput.value = detail.summary || "";
    dateInput.value = detail.date || new Date().toISOString().slice(0, 10);
    imageInput.value = detail.imageUrl || "";
    sidebar.classList.add("open");
    sidebar.setAttribute("aria-hidden", "false");
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("archive-overlay-open");
    draw();
    sidebar.querySelector("[data-story-close]")?.focus();
  }

  function ordinal(day) {
    const remainder = day % 100;
    if (remainder >= 11 && remainder <= 13) return `${day}th`;
    if (day % 10 === 1) return `${day}st`;
    if (day % 10 === 2) return `${day}nd`;
    if (day % 10 === 3) return `${day}rd`;
    return `${day}th`;
  }

  function setDailyUpdate() {
    const now = new Date();
    const day = now.toLocaleDateString("en-US", { weekday: "long" });
    const month = now.toLocaleDateString("en-US", { month: "long" });
    imageInput.value = "";
    titleInput.value = `Updates — ${day}, ${month} ${ordinal(now.getDate())}`;
    summaryInput.value = "Recent records from Gaza and Palestine, collected to preserve the public record and resist erasure.";
    dateInput.value = now.toISOString().slice(0, 10);
    draw();
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("No image"));
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        const proxy = new Image();
        proxy.crossOrigin = "anonymous";
        proxy.onload = () => resolve(proxy);
        proxy.onerror = () => reject(new Error("Image unavailable"));
        proxy.src = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=2000&fit=cover`;
      };
      image.src = url;
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    let line = "";
    let currentY = y;
    let lines = 0;
    for (let index = 0; index < words.length; index += 1) {
      const candidate = `${line}${words[index]} `;
      if (context.measureText(candidate).width > maxWidth && line && lines < maxLines - 1) {
        context.fillText(line.trim(), x, currentY);
        line = `${words[index]} `;
        currentY += lineHeight;
        lines += 1;
      } else {
        line = candidate;
      }
    }
    if (line && lines < maxLines) context.fillText(line.trim(), x, currentY);
    return currentY + lineHeight;
  }

  async function draw() {
    const sequence = ++drawSequence;
    const size = 2000;
    canvas.width = size;
    canvas.height = size;
    context.fillStyle = "#0a0a0a";
    context.fillRect(0, 0, size, size);

    try {
      const image = await loadImage(imageInput.value.trim());
      if (sequence !== drawSequence) return;
      const imageAspect = image.width / image.height;
      let sx = 0;
      let sy = 0;
      let sw = image.width;
      let sh = image.height;
      if (imageAspect > 1) {
        sw = image.height;
        sx = (image.width - sw) / 2;
      } else {
        sh = image.width;
        sy = (image.height - sh) / 2;
      }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
    } catch (error) {
      context.fillStyle = "#151515";
      context.fillRect(0, 0, size, size);
    }

    if (sequence !== drawSequence) return;
    const overlay = context.createLinearGradient(0, 0, 0, size);
    overlay.addColorStop(0, "rgba(0,0,0,0.28)");
    overlay.addColorStop(0.58, "rgba(0,0,0,0.82)");
    overlay.addColorStop(1, "rgba(0,0,0,1)");
    context.fillStyle = overlay;
    context.fillRect(0, 0, size, size);

    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = '700 40px "Playfair Display", Georgia, serif';
    context.fillText("ECHOES OF GAZA", 100, 110);

    const startX = 100;
    const textX = 140;
    const maxWidth = size - 260;
    let currentY = 990;
    context.fillStyle = "#8b0000";
    context.fillRect(startX, currentY, 14, 430);

    context.fillStyle = "#c9a84c";
    context.font = '700 30px Inter, Arial, sans-serif';
    context.fillText(`${(dateInput.value || "").toUpperCase()} / ARCHIVE`, textX, currentY + 30);

    currentY += 120;
    context.fillStyle = "#ffffff";
    context.font = '700 80px "Playfair Display", Georgia, serif';
    currentY = wrapText(titleInput.value, textX, currentY, maxWidth, 98, 5);

    currentY += 25;
    context.fillStyle = "#c8c2b8";
    context.font = "400 42px Inter, Arial, sans-serif";
    wrapText(summaryInput.value, textX, currentY, maxWidth, 65, 6);

    context.fillStyle = "rgba(255,255,255,0.45)";
    context.font = "600 25px Inter, Arial, sans-serif";
    context.textAlign = "right";
    context.fillText("ECHOESOFGAZA.ORG", size - 100, size - 80);
  }

  async function shareOrDownload() {
    draw();
    await new Promise(resolve => window.setTimeout(resolve, 80));
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "echoes-of-gaza-story.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Echoes of Gaza record",
          text: "A record from echoesofgaza.org"
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const link = document.createElement("a");
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  window.addEventListener("openStoryGenerator", event => open(event.detail || {}));
  backdrop.addEventListener("click", close);
  root.querySelectorAll("[data-story-close]").forEach(button => button.addEventListener("click", close));
  [imageInput, titleInput, summaryInput, dateInput].forEach(input => input.addEventListener("input", draw));
  document.getElementById("story-generate-daily").addEventListener("click", setDailyUpdate);
  document.getElementById("story-share").addEventListener("click", shareOrDownload);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) close();
  });
})();
