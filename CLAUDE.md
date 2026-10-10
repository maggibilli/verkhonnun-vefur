# Verkhönnun vefur

Vefur verkhonnun.is: static HTML/CSS/JS án build-skrefs, efni úr Supabase (verkefni `ixoenzikoklsfzekyqdz`) og stjórnborð í `admin.html`.

Repoið býr í GitHub organization **Verkhonnun** (`github.com/Verkhonnun/verkhonnun-vefur`, fluttist af `maggibilli`). Deploy: GitHub Pages þjónar `main` (rót repo) á verkhonnun.is (sérlén í `CNAME`). Workflow `.github/workflows/prerender.yml` keyrir `tools/prerender.py` á 6 klst. fresti, skrifar efni úr Supabase inn í `index.html` og commitar með `GITHUB_TOKEN`. Engin leyndarmál eru notuð.

Ef þú breytir uppbyggingu `index.html` eða birtingarlógík í `js/site.js`, haltu `tools/prerender.py` í takt.
