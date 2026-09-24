#!/usr/bin/env python3
"""
prerender.py — sækir efni úr Supabase og skrifar það sem raunverulegt HTML
inn í index.html, svo leitarvélar sjái textann án þess að keyra JavaScript.

Keyrist sjálfkrafa úr GitHub Actions (sjá .github/workflows/prerender.yml)
og má líka keyra handvirkt:  python tools/prerender.py

Ferlið er endurkeyranlegt: það skrifar á milli <!--vh:xxx--> merkjanna og
setur texta í öll [data-key] element. Ekkert fer forgörðum þótt það keyri oft.
"""
import json
import os
import re
import sys
import urllib.request

SUPABASE_URL = "https://ixoenzikoklsfzekyqdz.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4b2Vuemlrb2tsc2Z6ZWt5cWR6Iiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3ODIxNTE3ODIsImV4cCI6MjA5NzcyNzc4Mn0."
    "c1tLtXj7rftKXB9Y0c2CFak_Pg79gg2MPJzOMYQ4s5M"
)
MEDIA = f"{SUPABASE_URL}/storage/v1/object/public/media/"
HTML_FILE = os.path.join(os.path.dirname(__file__), "..", "index.html")

LANG = "is"  # forsíðan er forsteypt á íslensku; EN birtist áfram með JS


def fetch(table, select="*", order=None, extra=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}{extra}"
    if order:
        url += f"&order={order}"
    req = urllib.request.Request(url, headers={"apikey": ANON_KEY,
                                               "Authorization": f"Bearer {ANON_KEY}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def esc(s):
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def media_url(path):
    return MEDIA + path if path else None


# ---------- birting (speglar js/site.js) ----------

def render_services(rows):
    out = []
    for s in rows:
        link = (s.get("link") or "").strip()
        body = (
            f'<div class="svc__num">{esc(s["num"])}</div>'
            f'<div class="svc__body">'
            f'<span class="ic svc__ic vh-svg" data-vh="assets/icons/{esc(s.get("icon") or "i19")}.svg"></span>'
            f'<div class="svc__t">{esc(s["title_" + LANG])}</div>'
            f'<p class="svc__d">{esc(s["desc_" + LANG])}</p>'
            + (f'<div class="svc__more">Nánar →</div>' if link else "")
            + "</div>"
        )
        out.append(f'<a class="svc__row svc__row--link" href="{esc(link)}">{body}</a>'
                   if link else f'<div class="svc__row">{body}</div>')
    return "".join(out)


def render_values(rows):
    return "".join(
        f'<div class="val"><div class="val__num">{esc(v["num"])}</div>'
        f'<div><h3>{esc(v["title_" + LANG])}</h3><p>{esc(v["desc_" + LANG])}</p></div></div>'
        for v in rows)


def render_guides(rows):
    return "".join(
        f'<div class="guide"><h4>{esc(g["title_" + LANG])}</h4>'
        f'<p>{esc(g["desc_" + LANG])}</p></div>' for g in rows)


def render_projects(rows):
    out = []
    for p in rows:
        img, img2 = media_url(p.get("image_path")), media_url(p.get("hover_image_path"))
        if img:
            media = f'<img src="{esc(img)}" alt="{esc(p["title_" + LANG])}" loading="lazy">'
            if img2:
                media += f'<img class="proj__imghover" src="{esc(img2)}" alt="" loading="lazy">'
        else:
            media = ('<span class="wm vh-svg" data-vh="assets/logo/symbol-green.svg" '
                     'style="width:38%;right:-4%;bottom:-8%;"></span>'
                     '<span class="proj__ph">Ljósmynd</span>')
        meta = (p.get("meta_" + LANG) or "").strip()
        out.append(
            f'<article class="proj"><div class="proj__img">{media}'
            f'<span class="proj__tag">{esc(p["tag_" + LANG])}</span></div>'
            f'<div class="proj__txt"><h3>{esc(p["title_" + LANG])}</h3>'
            f'<p>{esc(p["desc_" + LANG])}</p>'
            + (f'<div class="proj__meta">{esc(meta)}</div>' if meta else "")
            + "</div></article>")
    return "".join(out)


def render_team(rows):
    out = []
    for m in rows:
        img, img2 = media_url(m.get("image_path")), media_url(m.get("hover_image_path"))
        if img:
            media = f'<img src="{esc(img)}" alt="{esc(m["name"])}" loading="lazy">'
            if img2:
                media += f'<img class="mem__imghover" src="{esc(img2)}" alt="" loading="lazy">'
        else:
            media = ('<span class="wm vh-svg" data-vh="assets/logo/symbol-green.svg" '
                     'style="width:52%;left:50%;transform:translateX(-50%);bottom:-11%;"></span>'
                     '<span class="mem__ph">Portrett</span>')
        email = (m.get("email") or "").strip()
        phone = (m.get("phone") or "").strip()
        contact = ""
        if email:
            contact += f'<a class="mem__c" href="mailto:{esc(email)}">{esc(email)}</a>'
        if phone:
            tel = re.sub(r"\s+", "", phone)
            contact += f'<a class="mem__c" href="tel:{esc(tel)}">{esc(phone)}</a>'
        out.append(
            f'<div class="mem"><div class="mem__img">{media}</div>'
            f'<h4>{esc(m["name"])}</h4><span>{esc(m["role_" + LANG])}</span>'
            + (f'<div class="mem__contact">{contact}</div>' if contact else "")
            + "</div>")
    return "".join(out)


def main():
    content = {r["key"]: r for r in fetch("site_content", "key,value_is,value_en")}
    blocks = {
        "services": render_services(fetch("services", order="sort_order")),
        "values":   render_values(fetch("core_values", order="sort_order")),
        "guides":   render_guides(fetch("guides", order="sort_order")),
        "projects": render_projects(fetch("projects", order="sort_order",
                                          extra="&published=eq.true")),
        "team":     render_team(fetch("team", order="sort_order",
                                      extra="&published=eq.true")),
    }

    path = os.path.normpath(HTML_FILE)
    html = open(path, encoding="utf-8").read()
    before = html

    # 1) listarnir á milli merkjanna
    for name, markup in blocks.items():
        pat = re.compile(r"(<!--vh:%s-->).*?(<!--/vh:%s-->)" % (name, name), re.S)
        if not pat.search(html):
            print(f"  ! merki fyrir '{name}' fundust ekki", file=sys.stderr)
            continue
        html = pat.sub(lambda m: m.group(1) + markup + m.group(2), html)

    # 2) allir [data-key] textar
    def repl(m):
        key = m.group("key")
        row = content.get(key)
        if not row:
            return m.group(0)
        return m.group("open") + esc(row["value_" + LANG]) + m.group("close")

    html = re.sub(
        r'(?P<open><[a-zA-Z][^>]*\bdata-key="(?P<key>[^"]+)"[^>]*>)(?P<txt>[^<]*)(?P<close></)',
        repl, html)

    if html == before:
        print("Engin breyting.")
        return 0

    open(path, "w", encoding="utf-8", newline="\n").write(html)
    print("index.html uppfært:")
    for name, markup in blocks.items():
        print(f"  {name:9} {len(markup):>6} stafir")
    print(f"  textar    {len(content)} lyklar")
    return 0


if __name__ == "__main__":
    sys.exit(main())
