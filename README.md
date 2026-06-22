# Verkhönnun — vefur með stjórnborði

Opinber vefsíða Verkhönnunar (hönnun „Lausnir“) ásamt admin-stjórnborði þar sem
hægt er að breyta öllu efni, hlaða upp myndum og sjá fyrirspurnir úr tengiliðaformi.

- **Bakendi:** Supabase (Postgres + Storage + Auth) — verkefni `Verkhonnun vefur`
  (ref: `ixoenzikoklsfzekyqdz`, svæði eu-north-1).
- **Framendi:** kyrrstæðar skrár (HTML/CSS/JS), engin byggingarskref. Tala beint
  við Supabase í gegnum `@supabase/supabase-js`.

```
site/
├─ index.html        ← opinbera síðan
├─ admin.html        ← stjórnborð (/admin)
├─ fonts.css
├─ css/
│  ├─ styles.css     ← stíll opinberu síðunnar
│  └─ admin.css      ← stíll stjórnborðs
├─ js/
│  ├─ config.js      ← Supabase slóð + opinber lykill
│  ├─ brand.js       ← innfellir SVG-merki
│  ├─ site.js        ← sækir efni, birtir, IS/EN, contact-form
│  └─ admin.js       ← innskráning + ritlar + myndir + fyrirspurnir
└─ assets/           ← letur, tákn, merki, favicon
```

---

## 1. Stilla Google-innskráningu (gera þetta EINU SINNI)

Stjórnborðið notar Google-innskráningu og hleypir aðeins inn netföngum á `@verkhonnun.is`.
Til að það virki þarf að tengja Google við Supabase:

### a) Búa til Google OAuth client
1. Farðu á <https://console.cloud.google.com/> → veldu/búðu til verkefni.
2. **APIs & Services → OAuth consent screen**: veldu *Internal* (ef Google Workspace
   fyrir verkhonnun.is) eða *External*. Fylltu út nafn og styðjandi netfang.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URI** — settu nákvæmlega þetta:
     ```
     https://ixoenzikoklsfzekyqdz.supabase.co/auth/v1/callback
     ```
4. Afritaðu **Client ID** og **Client secret**.

### b) Virkja Google í Supabase
1. Supabase Dashboard → verkefnið `Verkhonnun vefur` → **Authentication → Sign In / Providers → Google**.
2. Kveiktu á Google, límdu inn **Client ID** og **Client secret**, vistaðu.

### c) Stilla leyfðar slóðir (Redirect URLs)
Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL:** slóð vefsins, t.d. `https://verkhonnun.is`
- **Redirect URLs:** bættu við slóð stjórnborðsins, t.d.:
  ```
  https://verkhonnun.is/admin.html
  http://localhost:5500/admin.html      (fyrir prófanir á tölvunni)
  ```

> Lénstakmörkunin `@verkhonnun.is` er tryggð á tveimur stöðum: í `admin.js`
> (vísar notanda frá við innskráningu) og í gagnagrunninum sjálfum með RLS-reglu
> (`public.is_admin()`), svo enginn kemst í gögnin án rétts netfangs — jafnvel þótt
> hann komist fram hjá viðmótinu.

---

## 2. Keyra á tölvunni (prófun)

`file://` dugar ekki fyrir innskráninguna (Google þarf raunverulega slóð). Keyrðu
einfaldan vefþjón úr `site/` möppunni:

```bash
# Python
python -m http.server 5500

# eða Node
npx serve -l 5500
```

Opnaðu svo:
- Vefur: <http://localhost:5500/>
- Stjórnborð: <http://localhost:5500/admin.html>

(Mundu að bæta `http://localhost:5500/admin.html` við Redirect URLs, sjá 1c.)

---

## 3. Hýsing (birta vefinn)

Allt eru kyrrstæðar skrár, svo hvaða static-hýsing sem er virkar. Tvær einfaldar leiðir:

### Valkostur A — Netlify / Vercel / Cloudflare Pages (ókeypis, mælt með)
1. Dragðu `site/` möppuna inn á t.d. <https://app.netlify.com/drop>, eða tengdu git-repo.
2. Tengdu lénið `verkhonnun.is` við hýsinguna.
3. Uppfærðu **Site URL** og **Redirect URLs** í Supabase (sjá 1c) með réttu léni.

### Valkostur B — venjulegt vefhótel (1984, Verður o.fl.)
Hlaðið innihaldi `site/` upp í `public_html` með FTP. Sami hlutur: uppfærið slóðir
í Supabase.

> Eftir að lénið er komið: settu rétt **Site URL** í Supabase svo innskráning
> beini notendum aftur á réttan stað.

---

## 4. Daglegt: breyta efni

1. Opnaðu `…/admin.html`, skráðu þig inn með @verkhonnun.is Google-reikningi.
2. Flipar:
   - **Texti** — allir fastir textar (haus, hero, fyrirsagnir, fótur) á IS og EN.
   - **Þjónusta / Gildi / Leiðarljós / Verkefni / Teymi** — bæta við, breyta, eyða,
     raða (↑/↓). Verkefni og teymi geta haft mynd.
   - **Fyrirspurnir** — skilaboð úr tengiliðaforminu; merkja lesið/ólesið, svara, eyða.
3. Breytingar birtast strax á opinberu síðunni (hún sækir efnið beint úr Supabase).

---

## 5. Tæknilegt yfirlit (gagnagrunnur)

| Tafla          | Hlutverk                                             |
|----------------|------------------------------------------------------|
| `site_content` | Fastir textar, `key` + `value_is` / `value_en`        |
| `services`     | Þjónustuliðir                                         |
| `core_values`  | Gildi (kjarninn)                                     |
| `guides`       | Leiðarljós                                           |
| `projects`     | Verkefni (+ `image_path`)                            |
| `team`         | Teymismeðlimir (+ `image_path`)                      |
| `submissions`  | Fyrirspurnir úr formi                                |
| Storage bucket | `media` (opinber lestur, admin hleður upp)           |

**RLS (öryggi):** allir mega *lesa* efni og *senda inn* fyrirspurn. Aðeins innskráð
netföng á `@verkhonnun.is` mega skrifa efni, hlaða upp myndum eða lesa fyrirspurnir.

Opinberi lykillinn í `js/config.js` er ætlaður fyrir framendann og er óhætt að birta —
hann veitir engan aðgang umfram RLS-reglurnar.
