#!/usr/bin/env python3
"""Fetch recent PubMed and Europe PMC preprint records for daily-search-trend.

This helper intentionally returns metadata only. The calling agent translates
titles, scores interest, categorizes items, and writes Markdown.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import urllib.error


NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "daily-search-trend/0.1"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def as_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def clean_title(value: object) -> str:
    text = as_text(value)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return " ".join(text.split())


def split_keywords(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_target_date(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid date: {value!r}. Use YYYY-MM-DD.") from exc


def pubmed_query(keywords: list[str], target_date: dt.date, max_results: int) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    id_keywords: dict[str, set[str]] = {}
    ordered_ids: list[str] = []
    target_date_text = target_date.strftime("%Y/%m/%d")
    for keyword in keywords:
        params = {
            "db": "pubmed",
            "term": f'"{keyword}" AND ({target_date_text}[EDAT] : {target_date_text}[EDAT])',
            "retmode": "json",
            "retmax": str(max_results),
            "sort": "pub+date",
        }
        esearch_url = f"{NCBI_EUTILS}/esearch.fcgi?{urllib.parse.urlencode(params)}"
        try:
            ids = get_json(esearch_url).get("esearchresult", {}).get("idlist", [])
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            errors.append(f"PubMed esearch failed for {keyword}: {exc}")
            continue
        for pmid in ids:
            if pmid not in id_keywords:
                ordered_ids.append(pmid)
                id_keywords[pmid] = set()
            id_keywords[pmid].add(keyword)
    ids = ordered_ids[:max_results]
    if not ids:
        return [], errors

    summary_params = {
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "json",
    }
    summary_url = f"{NCBI_EUTILS}/esummary.fcgi?{urllib.parse.urlencode(summary_params)}"
    try:
        data = get_json(summary_url).get("result", {})
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return [], [f"PubMed esummary failed: {exc}"]
    records = []
    for pmid in data.get("uids", []):
        item = data.get(pmid, {})
        records.append(
            {
                "source": "PubMed",
                "id": pmid,
                "title": clean_title(item.get("title", "")),
                "published": item.get("pubdate", ""),
                "journal": item.get("fulljournalname") or item.get("source", ""),
                "doi": next(
                    (
                        aid.get("value")
                        for aid in item.get("articleids", [])
                        if aid.get("idtype") == "doi"
                    ),
                    "",
                ),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "target_date": target_date.isoformat(),
                "matched_keywords": sorted(id_keywords.get(pmid, set())),
            }
        )
    return records, errors


def europe_pmc_preprints(keywords: list[str], target_date: dt.date, max_results: int) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    records_by_key: dict[str, dict] = {}
    target_date_text = target_date.isoformat()
    for keyword in keywords:
        query = f'TITLE_ABS:"{keyword}" SRC:PPR FIRST_IDATE:[{target_date_text} TO {target_date_text}] sort_date:y'
        params = {
            "query": query,
            "format": "json",
            "resultType": "lite",
            "pageSize": str(max_results),
        }
        url = f"{EUROPE_PMC}?{urllib.parse.urlencode(params)}"
        try:
            results = get_json(url).get("resultList", {}).get("result", [])
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            errors.append(f"Europe PMC preprint search failed for {keyword}: {exc}")
            continue
        for item in results:
            title = clean_title(item.get("title", ""))
            doi = item.get("doi", "")
            metadata_blob = " ".join(
                [
                    as_text(title),
                    as_text(doi),
                    as_text(item.get("journalTitle", "")),
                    as_text(item.get("bookOrReportDetails", "")),
                    as_text(item.get("source", "")),
                ]
            ).lower()
            full_text_urls = item.get("fullTextUrlList", {}).get("fullTextUrl", [])
            full_text_url = full_text_urls[0].get("url", "") if full_text_urls else ""
            server = "bioRxiv" if "biorxiv" in metadata_blob or "10.1101" in doi else "Europe PMC preprint"
            record = {
                "source": server,
                "id": item.get("id", ""),
                "title": title,
                "published": item.get("firstPublicationDate") or item.get("firstIndexDate", ""),
                "journal": item.get("journalTitle", ""),
                "doi": doi,
                "url": item.get("doiUrl") or full_text_url or f"https://europepmc.org/article/PPR/{item.get('id', '')}",
                "target_date": target_date_text,
                "matched_keywords": [],
            }
            key = (record.get("doi") or record.get("url") or record.get("title") or "").lower()
            if not key:
                continue
            if key not in records_by_key:
                records_by_key[key] = record
            records_by_key[key]["matched_keywords"].append(keyword)
    records = []
    for record in records_by_key.values():
        record["matched_keywords"] = sorted(set(record["matched_keywords"]))
        records.append(record)
    return records[:max_results], errors


def dedupe(records: list[dict]) -> list[dict]:
    seen: set[str] = set()
    output: list[dict] = []
    for record in records:
        key = (record.get("doi") or record.get("url") or record.get("title") or "").lower()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keywords", required=True, help="Comma-separated keyword list.")
    parser.add_argument("--hours", type=int, default=24, help="Search window in hours; APIs use day-level filters.")
    parser.add_argument("--target-date", type=parse_target_date, help="Exact target day in YYYY-MM-DD. Overrides --hours windowing.")
    parser.add_argument("--max-results", type=int, default=50)
    args = parser.parse_args()

    keywords = split_keywords(args.keywords)
    if not keywords:
        print("No keywords provided", file=sys.stderr)
        return 2

    now = dt.datetime.now(dt.timezone.utc)
    if args.target_date is not None:
        target_date = args.target_date
        start = dt.datetime.combine(target_date, dt.time.min, tzinfo=dt.timezone.utc)
        end = dt.datetime.combine(target_date + dt.timedelta(days=1), dt.time.min, tzinfo=dt.timezone.utc)
        window_note = "PubMed EDAT and Europe PMC FIRST_IDATE are pinned to the exact target day."
    else:
        start = now - dt.timedelta(hours=args.hours)
        target_date = start.date()
        end = now
        window_note = "APIs use day-level filters; records are pinned to the derived target date."

    records = []
    errors = []
    pubmed_records, pubmed_errors = pubmed_query(keywords, target_date, args.max_results)
    preprint_records, preprint_errors = europe_pmc_preprints(keywords, target_date, args.max_results)
    records.extend(pubmed_records)
    records.extend(preprint_records)
    errors.extend(pubmed_errors)
    errors.extend(preprint_errors)
    payload = {
        "window": {
            "hours": args.hours,
            "from_utc": start.isoformat(),
            "to_utc": end.isoformat(),
            "target_date": target_date.isoformat(),
            "note": window_note,
        },
        "keywords": keywords,
        "errors": errors,
        "records": dedupe(records),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
