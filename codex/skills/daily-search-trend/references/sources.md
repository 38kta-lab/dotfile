# Sources And Queries

Use this reference when running `daily-search-trend`.

## Default Research Themes

Use these when the user does not provide keywords:

Broad field keywords:

- photosynthesis
- cyanobacteria
- photoreceptor
- molecular evolution
- optogenetics

Focused portfolio keywords:

- cyanobacteriochrome
- bilin biosynthesis
- phycobilisome
- phycobiliprotein
- Acaryochloris marina

## Paper And Preprint Sources

Keyword filtering is used only for PubMed and bioRxiv-relevant preprints.

- PubMed: query NCBI E-utilities.
- bioRxiv preprints: query Europe PMC REST with `SRC:PPR`; direct bioRxiv API keyword search is not the primary path.
- DOI or publisher pages: use only to verify metadata if API results are ambiguous.

PubMed API pattern:

```text
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pubmed
  &term=<keyword query>
  &datetype=edat
  &reldate=1
  &retmode=json

https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
  ?db=pubmed
  &id=<comma-separated PMIDs>
  &retmode=json
```

Europe PMC preprint API pattern:

```text
https://www.ebi.ac.uk/europepmc/webservices/rest/search
  ?query=(TITLE_ABS:<keyword query>) SRC:PPR FIRST_IDATE:[YYYY-MM-DD TO YYYY-MM-DD]
  &format=json
  &resultType=lite
  &pageSize=100
```

Notes:

- Europe PMC search syntax supports `TITLE_ABS`, `FIRST_IDATE`, and `SRC:PPR`.
- Treat Europe PMC `SRC:PPR` as a preprint pool and prefer records that identify bioRxiv in source metadata, journal/title metadata, DOI pattern, or URL.
- If source metadata does not cleanly distinguish bioRxiv, include the item under Europe PMC preprints and state the limitation.
- When an API only supports day-level filtering, filter to 24 hours in post-processing when timestamps exist; otherwise record the limitation.

## Science And Biology News Sources

Do not keyword-filter these sources by default. Check their newest posts or feed entries and include items posted on the target day, which is normally the day before the skill execution date.

- Nature News
- Science / AAAS News
- ナゾロジー（自然科学）

For each site, prefer RSS/feed/API/recent-news pages when available. If a site lacks a reliable feed or date filter, use web search constrained to that domain and the target date.

News URLs:

- Nature News primary RSS: https://www.nature.com/nature.rss
- Nature News browser reference: https://www.nature.com/news
- Science / AAAS News primary RSS: https://www.science.org/rss/news_current.xml
- Science / AAAS News browser reference: https://www.science.org/news
- ナゾロジー（自然科学） primary RSS: https://nazology.kusuguru.co.jp/archives/category/nature/feed
- ナゾロジー（自然科学） browser reference: https://nazology.kusuguru.co.jp/archives/category/nature

Nature News RSS handling:

- Use `https://www.nature.com/nature.rss` as the primary source.
- Fetch with a browser-like User-Agent when using CLI tools, for example: `curl -L -A "Mozilla/5.0" https://www.nature.com/nature.rss`.
- Parse RSS/RDF `item` entries.
- Use `dc:date` to filter to the target day.
- Use `title` or `dc:title` for the original title and `link` or `prism:url` for the URL.
- Use the HTML page `https://www.nature.com/news` only as a human browser reference.
- If the RSS feed fails, fall back to web search constrained to `site:nature.com/articles/d41586` with the target date.

Science / AAAS RSS handling:

- Use `https://www.science.org/rss/news_current.xml` as the primary source.
- Fetch with a browser-like User-Agent when using CLI tools, for example: `curl -L -A "Mozilla/5.0" https://www.science.org/rss/news_current.xml`.
- Parse RSS/RDF `item` entries.
- Use `dc:date`, `prism:coverDate`, or `prism:coverDisplayDate` to filter to the target day.
- Use `title` for the original title and `link` or `prism:url` for the URL.
- Do not use the HTML page `https://www.science.org/news` as the primary machine source because it can return a Cloudflare challenge/403 outside a normal browser.
- If the RSS feed fails, fall back to web search constrained to `site:science.org/content/article` with the target date.

ナゾロジー（自然科学） handling:

- Use `https://nazology.kusuguru.co.jp/archives/category/nature/feed` as the primary source.
- Parse RSS `item` entries.
- Use `pubDate` to filter to the target day.
- Use `title` for the original title and `link` for the URL.
- Because this source is Japanese, omit `タイトル訳` in the output table and use the two-column shape: `原文タイトル | 興味度`.

## Research Institution Announcements

Do not check research-institution announcements by default.

Only check these when the user explicitly asks for `研究機関発表` or names institutions and gives or implies a date range, such as `1か月前まで`. When checking institution announcements, use the user-specified date range instead of the previous-day default.

Initial institution candidates:

- RIKEN: build the year-specific URL from the run date or requested date range, e.g. `https://www.riken.jp/press/YYYY/index.html`
- JAMSTEC: https://www.jamstec.go.jp/e/about/press_release/
- NIBB: use the official NIBB press/news page confirmed at run time.

RIKEN handling:

- Do not use `https://www.riken.jp/press/` as the main machine URL.
- Build `https://www.riken.jp/press/YYYY/index.html` from the execution date year or the year(s) covered by the requested range.
- If the user asks for a range that crosses years, check each relevant yearly page.
- Filter entries by the user-specified date range after collecting from the yearly page(s).

## Interest Guidance

Score items higher when they mention:

- photosynthesis, phototrophy, carbon fixation, electron transport, photosystems
- cyanobacteria, algae, microalgae, diatoms, Chlamydomonas, Synechocystis, Synechococcus, Prochlorococcus
- microbial physiology, environmental adaptation, bioengineering, omics, metabolic engineering
- methods or datasets that could support future research planning

Do not exclude records only because they look weakly related to the user's portfolio. Keep low-relevance items and score them as `★☆☆☆☆` or `☆☆☆☆☆` rather than silently dropping them.

For science/news and requested institution sources, include target-date posts even when they are not keyword matches, but score unrelated items low.
