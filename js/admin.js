/* ============================================================
   admin.js — Verkhönnun stjórnborð.
   Google-innskráning (@verkhonnun.is), ritlar fyrir texta,
   þjónustu, gildi, leiðarljós, verkefni, teymi + fyrirspurnir.
   ============================================================ */
(function () {
  const sb = window.vhClient;

  let currentEmail = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  // Einstök tákn (i14..i34 innihalda afrit — þetta eru einu einstöku táknin)
  const icons = ["i14", "i15", "i17", "i18", "i19", "i20", "i21", "i22", "i23", "i24", "i25"];

  // ---------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------
  async function initAuth() {
    const { data } = await sb.auth.getSession();
    handleSession(data.session);
    // ATH: ekki kalla á await sb.* beint inni í þessu callbacki — það læsir
    // auth-lásnum (deadlock). setTimeout keyrir handleSession utan við hann.
    sb.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => handleSession(session), 0);
    });

    $("login-btn").addEventListener("click", async () => {
      $("login-err").textContent = "";
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href.split("#")[0],
          queryParams: { hd: "verkhonnun.is", prompt: "select_account" },
        },
      });
      if (error) $("login-err").textContent = error.message;
    });
    $("logout-btn").addEventListener("click", async () => {
      await sb.auth.signOut();
      location.reload();
    });
  }

  async function handleSession(session) {
    const email = session && session.user && session.user.email;
    if (!session) return showLogin();
    // Aðgangur ræðst af hvítlista (admins-töflu), ekki léninu.
    const { data: allowed, error } = await sb.rpc("is_admin");
    if (error) {
      sb.auth.signOut();
      showLogin("Villa við að staðfesta aðgang. Reyndu aftur.");
      return;
    }
    if (!allowed) {
      sb.auth.signOut();
      showLogin("Netfangið " + (email || "") + " hefur ekki aðgang að stjórnborðinu. Hafðu samband við stjórnanda til að fá aðgang.");
      return;
    }
    showApp(email);
  }

  function showLogin(err) {
    $("app").hidden = true;
    $("login").hidden = false;
    if (err) $("login-err").textContent = err;
    if (window.VH_brand) window.VH_brand();
  }

  function showApp(email) {
    currentEmail = email;
    $("login").hidden = true;
    $("app").hidden = false;
    $("user-email").textContent = email;
    if (window.VH_brand) window.VH_brand();
    initTabs();
    openTab("text");
  }

  // ---------------------------------------------------------
  // TABS
  // ---------------------------------------------------------
  function initTabs() {
    $("tabs").querySelectorAll(".tab").forEach((b) => {
      b.addEventListener("click", () => {
        $("tabs").querySelectorAll(".tab").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        openTab(b.getAttribute("data-tab"));
      });
    });
  }

  function openTab(tab) {
    const panel = $("panel");
    panel.innerHTML = '<div class="loading">Hleð…</div>';
    if (tab === "text") return renderText(panel);
    if (tab === "submissions") return renderSubmissions(panel);
    if (tab === "admins") return renderAdmins(panel);
    return renderList(panel, TABLES[tab]);
  }

  // ---------------------------------------------------------
  // TEXTI (site_content)
  // ---------------------------------------------------------
  const GROUPS = {
    nav: "Valmynd", hero: "Forsíðuhaus (hero)", servicesSection: "Þjónusta — haus",
    about: "Um okkur", values: "Gildi — haus", guides: "Leiðarljós — haus",
    projects: "Verkefni — haus", team: "Teymi — haus", contact: "Hafa samband", footer: "Fótur",
  };

  async function renderText(panel) {
    const { data, error } = await sb.from("site_content").select("*").order("key");
    if (error) return (panel.innerHTML = errBox(error));
    const rows = data || [];

    const byGroup = {};
    rows.forEach((r) => {
      const g = r.key.split(".")[0];
      (byGroup[g] = byGroup[g] || []).push(r);
    });

    let html = `
      <div class="toolbar">
        <h2>Texti vefsíðunnar</h2>
        <div class="right">
          <span class="savestate" id="text-state"></span>
          <button class="btn btn--green" id="text-save">Vista allar breytingar</button>
        </div>
      </div>`;

    Object.keys(GROUPS).forEach((g) => {
      if (!byGroup[g]) return;
      html += `<div class="group">${esc(GROUPS[g])}</div>`;
      byGroup[g].forEach((r) => {
        const long = (r.value_is || "").length > 60 || (r.value_en || "").length > 60;
        const tag = long ? "textarea" : "input";
        const close = long ? "</textarea>" : "";
        const val_is = long ? esc(r.value_is) : `value="${esc(r.value_is)}"`;
        const val_en = long ? esc(r.value_en) : `value="${esc(r.value_en)}"`;
        html += `
          <div class="card" data-key="${esc(r.key)}">
            <div class="card__head"><span class="lbl">${esc(r.key)}</span></div>
            <div class="grid2">
              <div class="field"><label>Íslenska</label><${tag} data-f="is" ${long ? "" : val_is}>${long ? val_is : ""}${close}</div>
              <div class="field"><label>English</label><${tag} data-f="en" ${long ? "" : val_en}>${long ? val_en : ""}${close}</div>
            </div>
          </div>`;
      });
    });

    panel.innerHTML = html;

    $("text-save").addEventListener("click", async () => {
      const state = $("text-state");
      state.className = "savestate";
      state.textContent = "Vista…";
      const updates = [];
      panel.querySelectorAll(".card[data-key]").forEach((c) => {
        updates.push({
          key: c.getAttribute("data-key"),
          value_is: c.querySelector('[data-f="is"]').value,
          value_en: c.querySelector('[data-f="en"]').value,
          updated_at: new Date().toISOString(),
        });
      });
      const { error } = await sb.from("site_content").upsert(updates, { onConflict: "key" });
      if (error) { state.className = "savestate err"; state.textContent = "Villa"; }
      else { state.className = "savestate ok"; state.textContent = "Vistað ✓"; }
    });
  }

  // ---------------------------------------------------------
  // LISTAR (services, values, guides, projects, team)
  // ---------------------------------------------------------
  const TABLES = {
    services: {
      table: "services", title: "Þjónusta", image: false,
      label: (r) => r.title_is || "Ný þjónusta",
      fields: [
        { k: "num", l: "Númer", t: "text", w: "half" },
        { k: "icon", l: "Tákn", t: "icon", w: "half" },
        { k: "title_is", l: "Titill (IS)", t: "text" },
        { k: "title_en", l: "Titill (EN)", t: "text" },
        { k: "desc_is", l: "Lýsing (IS)", t: "area" },
        { k: "desc_en", l: "Lýsing (EN)", t: "area" },
      ],
    },
    values: {
      table: "core_values", title: "Gildi", image: false,
      label: (r) => r.title_is || "Nýtt gildi",
      fields: [
        { k: "num", l: "Númer", t: "text", w: "half" },
        { k: "title_is", l: "Titill (IS)", t: "text" },
        { k: "title_en", l: "Titill (EN)", t: "text" },
        { k: "desc_is", l: "Lýsing (IS)", t: "area" },
        { k: "desc_en", l: "Lýsing (EN)", t: "area" },
      ],
    },
    guides: {
      table: "guides", title: "Leiðarljós", image: false,
      label: (r) => r.title_is || "Nýtt leiðarljós",
      fields: [
        { k: "title_is", l: "Titill (IS)", t: "text" },
        { k: "title_en", l: "Titill (EN)", t: "text" },
        { k: "desc_is", l: "Lýsing (IS)", t: "area" },
        { k: "desc_en", l: "Lýsing (EN)", t: "area" },
      ],
    },
    projects: {
      table: "projects", title: "Verkefni", image: true, publishable: true,
      label: (r) => r.title_is || "Nýtt verkefni",
      fields: [
        { k: "tag_is", l: "Merki (IS)", t: "text", w: "half" },
        { k: "tag_en", l: "Merki (EN)", t: "text", w: "half" },
        { k: "title_is", l: "Titill (IS)", t: "text" },
        { k: "title_en", l: "Titill (EN)", t: "text" },
        { k: "desc_is", l: "Lýsing (IS)", t: "area" },
        { k: "desc_en", l: "Lýsing (EN)", t: "area" },
        { k: "meta_is", l: "Staður/ár (IS)", t: "text", w: "half" },
        { k: "meta_en", l: "Staður/ár (EN)", t: "text", w: "half" },
      ],
    },
    team: {
      table: "team", title: "Teymi", image: true, publishable: true,
      label: (r) => r.name || "Nýr meðlimur",
      fields: [
        { k: "name", l: "Nafn", t: "text" },
        { k: "role_is", l: "Hlutverk (IS)", t: "text", w: "half" },
        { k: "role_en", l: "Hlutverk (EN)", t: "text", w: "half" },
        { k: "email", l: "Netfang", t: "text", w: "half" },
        { k: "phone", l: "Símanúmer", t: "text", w: "half" },
      ],
    },
  };

  async function renderList(panel, cfg) {
    const { data, error } = await sb.from(cfg.table).select("*").order("sort_order");
    if (error) return (panel.innerHTML = errBox(error));
    const rows = data || [];

    let html = `
      <div class="toolbar">
        <h2>${esc(cfg.title)}</h2>
        <div class="right">
          <button class="btn btn--green" id="add-btn">+ Bæta við</button>
        </div>
      </div>
      <div id="rows">`;
    if (!rows.length) html += `<div class="empty">Engar færslur enn. Smelltu á „Bæta við“.</div>`;
    rows.forEach((r, i) => (html += cardHtml(cfg, r, i, rows.length)));
    html += `</div>`;
    panel.innerHTML = html;

    // events
    $("add-btn").addEventListener("click", async () => {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
      const { error } = await sb.from(cfg.table).insert({ sort_order: maxOrder + 1 });
      if (error) return alert("Villa: " + error.message);
      renderList(panel, cfg);
    });

    panel.querySelectorAll(".card[data-id]").forEach((card) => wireCard(panel, cfg, card, rows));
    if (window.VH_brand) window.VH_brand(); // innfella tákn í velaranum
  }

  function cardHtml(cfg, r, idx, total) {
    let fields = "";
    let pending = [];
    cfg.fields.forEach((f) => {
      if (f.w === "half") { pending.push(f); if (pending.length === 2) { fields += halfRow(pending, r); pending = []; } }
      else { if (pending.length) { fields += halfRow(pending, r); pending = []; } fields += fieldHtml(f, r); }
    });
    if (pending.length) fields += halfRow(pending, r);

    const img = cfg.image ? imageBlock(r) : "";
    const hidden = cfg.publishable && r.published === false;
    const toggle = cfg.publishable
      ? `<button class="btn btn--sm pubtoggle ${hidden ? "is-off" : "is-on"}" data-act="toggle" title="${hidden ? "Smelltu til að birta" : "Smelltu til að fela"}">${hidden ? "● Falið" : "● Birt"}</button>`
      : "";
    return `
      <div class="card${hidden ? " is-hidden" : ""}" data-id="${esc(r.id)}">
        <div class="card__head">
          <span class="lbl">${esc(cfg.label(r))}</span>
          <div class="right">
            <div class="order">
              <button data-act="up" ${idx === 0 ? "disabled" : ""} title="Færa upp">↑</button>
              <button data-act="down" ${idx === total - 1 ? "disabled" : ""} title="Færa niður">↓</button>
            </div>
            ${toggle}
            <span class="savestate" data-state></span>
            <button class="btn btn--green btn--sm" data-act="save">Vista</button>
            <button class="btn btn--danger btn--sm" data-act="del">Eyða</button>
          </div>
        </div>
        ${img}
        ${fields}
      </div>`;
  }

  function fieldHtml(f, r) {
    const v = r[f.k];
    if (f.t === "icon") {
      const cur = v || "i19";
      const cells = icons.map((ic) =>
        `<button type="button" class="iconpick__btn${ic === cur ? " is-sel" : ""}" data-ic="${ic}" title="${ic}">
           <span class="vh-svg" data-vh="assets/icons/${ic}.svg"></span>
         </button>`).join("");
      return `<div class="field"><label>${esc(f.l)}</label>
        <input type="hidden" data-f="${f.k}" value="${esc(cur)}">
        <div class="iconpick">${cells}</div></div>`;
    }
    if (f.t === "area") {
      return `<div class="field"><label>${esc(f.l)}</label><textarea data-f="${f.k}">${esc(v)}</textarea></div>`;
    }
    return `<div class="field"><label>${esc(f.l)}</label><input data-f="${f.k}" value="${esc(v)}"></div>`;
  }

  function halfRow(fs, r) {
    return `<div class="grid2">${fs.map((f) => fieldHtml(f, r)).join("")}</div>`;
  }

  function imageBlock(r) {
    const url = window.vhMediaUrl(r.image_path);
    const thumb = url
      ? `<img class="imgthumb" src="${esc(url)}" alt="">`
      : `<div class="imgthumb imgthumb--empty">Engin mynd</div>`;
    return `
      <div class="imgrow">
        ${thumb}
        <div>
          <input type="file" accept="image/*" data-img style="display:none">
          <button class="btn btn--ghost btn--sm" data-act="upload">Hlaða upp mynd</button>
          ${r.image_path ? `<button class="btn btn--danger btn--sm" data-act="rmimg">Fjarlægja</button>` : ""}
          <p class="hint" style="margin-top:8px;">JPG/PNG/WebP. Geymt í Supabase Storage.</p>
        </div>
      </div>`;
  }

  function wireCard(panel, cfg, card, rows) {
    const id = card.getAttribute("data-id");
    const state = card.querySelector("[data-state]");
    const setState = (cls, txt) => { state.className = "savestate " + cls; state.textContent = txt; };

    const gather = () => {
      const obj = {};
      card.querySelectorAll("[data-f]").forEach((el) => (obj[el.getAttribute("data-f")] = el.value));
      obj.updated_at = new Date().toISOString();
      return obj;
    };

    // sjónrænn tákn-velari: smellur setur falda input-gildið
    card.querySelectorAll(".iconpick").forEach((pick) => {
      const hidden = pick.parentElement.querySelector('input[type="hidden"][data-f]');
      pick.querySelectorAll(".iconpick__btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          pick.querySelectorAll(".iconpick__btn").forEach((b) => b.classList.remove("is-sel"));
          btn.classList.add("is-sel");
          if (hidden) hidden.value = btn.getAttribute("data-ic");
        });
      });
    });

    card.querySelector('[data-act="save"]').addEventListener("click", async () => {
      setState("", "Vista…");
      const { error } = await sb.from(cfg.table).update(gather()).eq("id", id);
      if (error) setState("err", "Villa");
      else { setState("ok", "Vistað ✓"); const lbl = card.querySelector(".lbl"); }
    });

    const toggleBtn = card.querySelector('[data-act="toggle"]');
    if (toggleBtn) toggleBtn.addEventListener("click", async () => {
      const row = rows.find((r) => String(r.id) === String(id));
      const next = !(row && row.published !== false); // núverandi birt -> fela
      const { error } = await sb.from(cfg.table).update({ published: next, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return alert("Villa: " + error.message);
      renderList(panel, cfg);
    });

    card.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm("Eyða þessari færslu?")) return;
      const { error } = await sb.from(cfg.table).delete().eq("id", id);
      if (error) return alert("Villa: " + error.message);
      renderList(panel, cfg);
    });

    const upBtn = card.querySelector('[data-act="up"]');
    const downBtn = card.querySelector('[data-act="down"]');
    if (upBtn && !upBtn.disabled) upBtn.addEventListener("click", () => swap(panel, cfg, rows, id, -1));
    if (downBtn && !downBtn.disabled) downBtn.addEventListener("click", () => swap(panel, cfg, rows, id, 1));

    if (cfg.image) {
      const fileInput = card.querySelector("[data-img]");
      const uploadBtn = card.querySelector('[data-act="upload"]');
      if (uploadBtn) uploadBtn.addEventListener("click", () => fileInput.click());
      if (fileInput) fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        setState("", "Hleð upp mynd…");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${cfg.table}/${id}-${Date.now()}.${ext}`;
        const up = await sb.storage.from(window.VH_SUPABASE.bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (up.error) {
          console.error("Upload error:", up.error);
          alert("Villa við að hlaða upp mynd:\n" + (up.error.message || up.error) + "\n(statusCode: " + (up.error.statusCode || "?") + ")");
          return setState("err", "Villa við upphal");
        }
        const { error } = await sb.from(cfg.table).update({ image_path: path, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) return setState("err", "Villa");
        renderList(panel, cfg);
      });
      const rmBtn = card.querySelector('[data-act="rmimg"]');
      if (rmBtn) rmBtn.addEventListener("click", async () => {
        const { error } = await sb.from(cfg.table).update({ image_path: null, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) return alert("Villa: " + error.message);
        renderList(panel, cfg);
      });
    }
  }

  async function swap(panel, cfg, rows, id, dir) {
    const idx = rows.findIndex((r) => String(r.id) === String(id));
    const other = rows[idx + dir];
    const cur = rows[idx];
    if (!other) return;
    await Promise.all([
      sb.from(cfg.table).update({ sort_order: other.sort_order }).eq("id", cur.id),
      sb.from(cfg.table).update({ sort_order: cur.sort_order }).eq("id", other.id),
    ]);
    renderList(panel, cfg);
  }

  // ---------------------------------------------------------
  // FYRIRSPURNIR (submissions)
  // ---------------------------------------------------------
  async function renderSubmissions(panel) {
    const { data, error } = await sb.from("submissions").select("*").order("created_at", { ascending: false });
    if (error) return (panel.innerHTML = errBox(error));
    const rows = data || [];

    let html = `<div class="toolbar"><h2>Fyrirspurnir (${rows.length})</h2></div>`;
    if (!rows.length) html += `<div class="empty">Engar fyrirspurnir hafa borist.</div>`;
    html += rows.map((r) => {
      const date = new Date(r.created_at).toLocaleString("is-IS");
      return `
        <div class="sub ${r.is_read ? "" : "unread"}" data-id="${esc(r.id)}">
          <div class="sub__top">
            <span class="sub__name">${esc(r.name)}</span>
            <a class="sub__email" href="mailto:${esc(r.email)}">${esc(r.email)}</a>
            ${r.is_read ? "" : '<span class="badge">Nýtt</span>'}
            <span class="sub__date">${esc(date)}</span>
          </div>
          <div class="sub__msg">${esc(r.message)}</div>
          <div class="sub__actions">
            ${r.is_read
              ? '<button class="btn btn--ghost btn--sm" data-act="unread">Merkja ólesið</button>'
              : '<button class="btn btn--ghost btn--sm" data-act="read">Merkja lesið</button>'}
            <a class="btn btn--green btn--sm" href="mailto:${esc(r.email)}?subject=Re%3A%20Fyrirspurn%20til%20Verkh%C3%B6nnunar">Svara</a>
            <button class="btn btn--danger btn--sm" data-act="del">Eyða</button>
          </div>
        </div>`;
    }).join("");
    panel.innerHTML = html;

    panel.querySelectorAll(".sub[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id");
      const read = el.querySelector('[data-act="read"]');
      const unread = el.querySelector('[data-act="unread"]');
      if (read) read.addEventListener("click", async () => {
        await sb.from("submissions").update({ is_read: true }).eq("id", id);
        renderSubmissions(panel);
      });
      if (unread) unread.addEventListener("click", async () => {
        await sb.from("submissions").update({ is_read: false }).eq("id", id);
        renderSubmissions(panel);
      });
      el.querySelector('[data-act="del"]').addEventListener("click", async () => {
        if (!confirm("Eyða þessari fyrirspurn?")) return;
        await sb.from("submissions").delete().eq("id", id);
        renderSubmissions(panel);
      });
    });
  }

  // ---------------------------------------------------------
  // AÐGANGUR (admins-hvítlisti)
  // ---------------------------------------------------------
  async function renderAdmins(panel) {
    const { data, error } = await sb.from("admins").select("*").order("added_at");
    if (error) return (panel.innerHTML = errBox(error));
    const rows = data || [];

    let html = `
      <div class="toolbar">
        <h2>Aðgangur að stjórnborði</h2>
      </div>
      <div class="card">
        <div class="card__head"><span class="lbl">Bæta við admin</span></div>
        <div class="grid2">
          <div class="field">
            <label>Netfang (@verkhonnun.is)</label>
            <input id="new-admin" type="email" placeholder="nafn@verkhonnun.is" autocomplete="off">
          </div>
          <div class="field" style="justify-content:flex-end;">
            <label>&nbsp;</label>
            <button class="btn btn--green" id="add-admin">Bæta við</button>
          </div>
        </div>
        <p class="field hint" id="admin-msg" style="min-height:1.2em;"></p>
        <p class="hint">Aðeins netföng á þessum lista komast inn í stjórnborðið. Viðkomandi þarf líka að skrá sig inn með Google-reikningi á sama netfangi.</p>
      </div>
      <div id="admin-rows">`;
    rows.forEach((r) => {
      const isMe = currentEmail && r.email.toLowerCase() === currentEmail.toLowerCase();
      const date = new Date(r.added_at).toLocaleDateString("is-IS");
      html += `
        <div class="card" data-email="${esc(r.email)}">
          <div class="card__head">
            <span class="lbl">${esc(r.email)}${isMe ? " — þú" : ""}</span>
            <div class="right">
              <span class="hint">bætt við ${esc(date)}</span>
              <button class="btn btn--danger btn--sm" data-act="del" ${isMe ? "disabled title='Þú getur ekki fjarlægt sjálfa/n þig'" : ""}>Fjarlægja</button>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
    panel.innerHTML = html;

    const msg = $("admin-msg");
    $("add-admin").addEventListener("click", async () => {
      const input = $("new-admin");
      const email = (input.value || "").trim().toLowerCase();
      msg.className = "field hint";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        msg.textContent = "Sláðu inn gilt netfang.";
        return;
      }
      msg.textContent = "Bæti við…";
      const { error } = await sb.from("admins").insert({ email, added_by: currentEmail });
      if (error) {
        msg.textContent = error.code === "23505" ? "Þetta netfang er þegar á listanum." : "Villa: " + error.message;
      } else {
        renderAdmins(panel);
      }
    });

    panel.querySelectorAll(".card[data-email]").forEach((card) => {
      const del = card.querySelector('[data-act="del"]');
      if (del && !del.disabled) del.addEventListener("click", async () => {
        const email = card.getAttribute("data-email");
        if (!confirm("Fjarlægja aðgang fyrir " + email + "?")) return;
        const { error } = await sb.from("admins").delete().eq("email", email);
        if (error) return alert("Villa: " + error.message);
        renderAdmins(panel);
      });
    });
  }

  // ---------------------------------------------------------
  function errBox(error) {
    return `<div class="empty">Villa við að sækja gögn: ${esc(error.message || error)}</div>`;
  }

  // start
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initAuth);
  else initAuth();
})();
