/* ============================================================
   brand.js — inlines Verkhönnun SVGs (logo, symbol, icons) so
   they render in every engine (real browsers AND html-to-image
   capture, unlike CSS masks). Color is controlled by CSS
   `color` via fill="currentColor"; hover/theme just work.

   Usage:  <span class="vh-svg ic" data-vh="assets/icons/i19.svg"></span>
   Size the span with CSS; the injected <svg> fills it 100%.
   ============================================================ */
(function () {
  const cache = {};
  function load(src) {
    if (!cache[src]) cache[src] = fetch(src).then((r) => r.text());
    return cache[src];
  }
  async function inject(el) {
    const src = el.getAttribute("data-vh");
    if (!src || el.dataset.vhDone) return;
    try {
      const txt = await load(src);
      const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return;
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.removeAttribute("id");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "width:100%;height:100%;display:block;pointer-events:none";
      // strip baked classes/fills so shapes inherit currentColor
      svg.querySelectorAll("[class],[fill]").forEach((n) => {
        n.removeAttribute("class");
        const f = n.getAttribute("fill");
        if (f && f !== "none") n.removeAttribute("fill");
      });
      el.innerHTML = "";
      el.appendChild(svg);
      el.dataset.vhDone = "1";
    } catch (e) {}
  }
  function run() {
    document.querySelectorAll("[data-vh]").forEach(inject);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", run);
  else run();
  window.VH_brand = run;
})();
