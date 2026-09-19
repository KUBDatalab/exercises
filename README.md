# KUB Datalab · Øvelser

Quarto-site til selvstudium efter KUB Datalabs kurser. R er første spor; strukturen kan udvides med Python.

- Forside og R-kursusoversigt.
- Øvelsessæt om objekter, vektorer og indeksering.
- `demo-oevelser.qmd`: alle aktive HTML-spørgsmålstyper i webexercises 1.2.0, svarregler, quizzer, hints og forfatterfunktioner.
- `vejledning/ny-oevelsesside.qmd`: arbejdsproces og genbrugelig skabelon i `templates/oevelse.qmd`.
- GoatCounter til sidevisninger, tilkoblet `https://kubdatalab.goatcounter.com/count`. Ingen svar eller quizresultater spores.

## Lokal brug

Installér R og Quarto CLI (CI bruger Quarto 1.7.32). Kør fra projektets rod:

```r
install.packages(c("remotes", "knitr", "rmarkdown"))
remotes::install_version("webexercises", version = "1.2.0", upgrade = "never")
```

```bash
quarto add r-wasm/quarto-live@v0.2.0 --no-prompt
quarto preview
quarto render
```

## Publicering

GitHub Actions bygger og tester før publicering til `gh-pages` i **dette repo**.
Vælg én gang **Settings → Pages → Deploy from a branch → gh-pages → / (root)**.
Site: https://kubdatalab.github.io/exercises/

Der skrives ikke til andre repositories. Workflowet har kun dette repos `GITHUB_TOKEN`.

## Test

```bash
npm install --no-save playwright@1.55.0
npx playwright install chromium
node tests/site.test.mjs
```

Browserkontrollen tester rigtige/forkerte/tomme svar, tolerance, regex, menuer,
radiofelter, quizzer, skjulte løsninger, danske kontrolknapper, lokal linkintegritet,
logo, mobilbredde og faktisk R-eksekvering med redigering, figurer og fejlretning. Screenshots gemmes i `test-results/`.

## Statistik

Åbn https://kubdatalab.goatcounter.com/ med ejerens konto.
Adressen står i `assets/analytics.js`; en tom streng slår tælleren fra.
Tælleren kører kun på `kubdatalab.github.io`, og indsamling i kontoen skal bekræftes
ved et besøg efter publicering. Se den indbyggede statistikvejledning.

## Webexercises

Versionen er fastholdt til 1.2.0. `assets/vendor/` indeholder uændrede upstream-filer.
`assets/site.js` tilføjer dansk tekst, tilgængelig feedback, input-event-håndtering
og normaliserer to upstream-kanttilfælde ved tolerance/regex. `quiz()`-argumenterne
`show_box`/`show_check` virker ikke som forventet i upstream 1.2.0 HTML; brug divs.
Se `assets/ATTRIBUTION.md` for kilder og tredjepartslicens.

## R i browseren

Quarto Live v0.2.0 og webR v0.6.0 giver redigerbare `{webr}`-blokke på demoen
og R-øvelsessiden. CI installerer udvidelsen før rendering; `_extensions/` er
genereret og ignoreret. Bygningen bruger fortsat knitr og webexercises.
Browserens R-session bruger base R, gemmer ikke kode og er separat fra build-R.
Se forfattervejledningen for opsætning, pakker og sessionens levetid.
