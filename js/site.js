/* ============================================================
   site.js — opinbera Verkhönnun síðan.
   Sækir allt efni úr Supabase, birtir það, sér um IS/EN
   tungumálaskipti og vistar fyrirspurnir úr contact-formi.
   ============================================================ */
(function () {
  const KEY = "vh-lang";
  const sb = window.vhClient;

  // ----- staða -----
  let lang = "is";
  try { lang = localStorage.getItem(KEY) || "is"; } catch (e) {}

  const state = {
    content: {},   // { key: {is, en} }
    services: [],
    values: [],
    guides: [],
    projects: [],
    team: [],
  };

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // ----- sækja gögn -----
  async function loadAll() {
    const [content, services, values, guides, projects, team] = await Promise.all([
      sb.from("site_content").select("key,value_is,value_en"),
      sb.from("services").select("*").order("sort_order"),
      sb.from("core_values").select("*").order("sort_order"),
      sb.from("guides").select("*").order("sort_order"),
      sb.from("projects").select("*").eq("published", true).order("sort_order"),
      sb.from("team").select("*").eq("published", true).order("sort_order"),
    ]);

    (content.data || []).forEach((r) => {
      state.content[r.key] = { is: r.value_is, en: r.value_en };
    });
    state.services = services.data || [];
    state.values = values.data || [];
    state.guides = guides.data || [];
    state.projects = projects.data || [];
    state.team = team.data || [];
  }

  // ----- birting lista (er endurkeyrt við tungumálaskipti) -----
  function renderLists() {
    const L = lang;

    document.getElementById("svc-list").innerHTML = state.services.map((s) => `
      <div class="svc__row">
        <div class="svc__num">${esc(s.num)}</div>
        <div class="svc__body">
          <span class="ic svc__ic vh-svg" data-vh="assets/icons/${esc(s.icon || "i19")}.svg"></span>
          <div class="svc__t">${esc(s["title_" + L])}</div>
          <p class="svc__d">${esc(s["desc_" + L])}</p>
        </div>
      </div>`).join("");

    document.getElementById("vals").innerHTML = state.values.map((v) => `
      <div class="val">
        <div class="val__num">${esc(v.num)}</div>
        <div><h3>${esc(v["title_" + L])}</h3>
        <p>${esc(v["desc_" + L])}</p></div>
      </div>`).join("");

    document.getElementById("guides").innerHTML = state.guides.map((g) => `
      <div class="guide">
        <h4>${esc(g["title_" + L])}</h4>
        <p>${esc(g["desc_" + L])}</p>
      </div>`).join("");

    document.getElementById("projs").innerHTML = state.projects.map((p) => {
      const img = window.vhMediaUrl(p.image_path);
      const media = img
        ? `<img src="${esc(img)}" alt="${esc(p["title_" + L])}" loading="lazy">`
        : `<span class="wm vh-svg" data-vh="assets/logo/symbol-green.svg" style="width:38%;right:-4%;bottom:-8%;"></span><span class="proj__ph">Ljósmynd</span>`;
      return `
      <article class="proj">
        <div class="proj__img">${media}<span class="proj__tag">${esc(p["tag_" + L])}</span></div>
        <div class="proj__txt">
          <h3>${esc(p["title_" + L])}</h3>
          <p>${esc(p["desc_" + L])}</p>
          <div class="proj__meta">${esc(p["meta_" + L])}</div>
        </div>
      </article>`;
    }).join("");

    document.getElementById("team").innerHTML = state.team.map((m) => {
      const img = window.vhMediaUrl(m.image_path);
      const media = img
        ? `<img src="${esc(img)}" alt="${esc(m.name)}" loading="lazy">`
        : `<span class="wm vh-svg" data-vh="assets/logo/symbol-green.svg" style="width:52%;left:50%;transform:translateX(-50%);bottom:-11%;"></span><span class="mem__ph">Portrett</span>`;
      const email = (m.email || "").trim();
      const phone = (m.phone || "").trim();
      const contact =
        (email ? `<a class="mem__c" href="mailto:${esc(email)}">${esc(email)}</a>` : "") +
        (phone ? `<a class="mem__c" href="tel:${esc(phone.replace(/\s+/g, ""))}">${esc(phone)}</a>` : "");
      return `
      <div class="mem">
        <div class="mem__img">${media}</div>
        <h4>${esc(m.name)}</h4>
        <span>${esc(m["role_" + L])}</span>
        ${contact ? `<div class="mem__contact">${contact}</div>` : ""}
      </div>`;
    }).join("");

    // innfella SVG-merki á ný
    if (window.VH_brand) window.VH_brand();
  }

  // ----- singleton textar + tungumál -----
  function applyLang(next) {
    lang = next === "en" ? "en" : "is";
    document.documentElement.setAttribute("lang", lang);

    document.querySelectorAll("[data-key]").forEach((el) => {
      const v = state.content[el.getAttribute("data-key")];
      if (v && v[lang] != null) {
        const text = v[lang];
        if (el.id === "contact-email") {
          el.textContent = text;
          el.setAttribute("href", "mailto:" + text);
        } else if (el.id === "contact-phone") {
          el.textContent = text;
          el.setAttribute("href", "tel:" + text.replace(/\s+/g, ""));
        } else {
          el.textContent = text;
        }
        // fela reit ef textinn er tómur (admin getur hreinsað texta til að fela hann)
        el.style.display = text.trim() === "" ? "none" : "";
      }
    });

    document.querySelectorAll("[data-lang]").forEach((b) => {
      const on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on);
    });

    try { localStorage.setItem(KEY, lang); } catch (e) {}
    window.VH_LANG = lang;
    renderLists();
  }

  // ----- contact form -----
  function wireForm() {
    const form = document.getElementById("contact-form");
    const msg = document.getElementById("form-msg");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        message: (fd.get("message") || "").toString().trim(),
      };
      msg.className = "form__msg";
      msg.textContent = lang === "en" ? "Sending…" : "Sendi…";
      const { error } = await sb.from("submissions").insert(payload);
      if (error) {
        msg.className = "form__msg err";
        msg.textContent = lang === "en"
          ? "Something went wrong. Please email us directly."
          : "Eitthvað fór úrskeiðis. Sendu okkur frekar tölvupóst.";
      } else {
        form.reset();
        msg.className = "form__msg ok";
        msg.textContent = lang === "en"
          ? "Thank you! We'll be in touch shortly."
          : "Takk fyrir! Við höfum samband fljótlega.";
      }
    });
  }

  // ----- init -----
  async function init() {
    try {
      await loadAll();
    } catch (e) {
      console.error("Villa við að sækja efni:", e);
    }
    applyLang(lang);
    wireForm();
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => applyLang(b.getAttribute("data-lang")));
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
