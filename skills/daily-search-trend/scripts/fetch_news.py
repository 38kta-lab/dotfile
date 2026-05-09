#!/usr/bin/env python3
"""Fetch Nature News, Science/AAAS News, and Nazology RSS feeds for daily-search-trend.

This helper replaces the previous shell-curl approach so the skill can run from
non-interactive contexts (e.g., iPhone Claude Code) where individual curl
permission prompts are not surfaced. All fetches use stdlib urllib with a
browser-like User-Agent. Output is JSON on stdout.

The script intentionally returns metadata only (title, url, date, source). The
calling agent translates titles, scores interest, and writes Markdown.
"""

from __future__ import annotations

import argparse
import datetime as dt
import http.client
import json
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape


USER_AGENT = "Mozilla/5.0 (compatible; daily-search-trend/0.2)"

# Fallback IPs for hosts that may be sinkholed by local DNS / hosts files
# (e.g., user's home network resolves nature.com to 127.0.0.1). These are
# Fastly / CDN IPs known to serve the corresponding feeds. Used only when
# socket-level connection to the resolved IP fails.
FALLBACK_IPS: dict[str, list[str]] = {
    "www.nature.com": ["151.101.0.95", "151.101.64.95"],
    "www.science.org": ["104.18.40.10", "172.64.147.246"],
}

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
    "prism": "http://prismstandard.org/namespaces/basic/2.0/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rss10": "http://purl.org/rss/1.0/",
}

SOURCES = {
    "nature": {
        "label": "Nature News",
        "url": "https://www.nature.com/nature.rss",
    },
    "science": {
        "label": "Science / AAAS News",
        "url": "https://www.science.org/rss/news_current.xml",
    },
    "nazology": {
        "label": "ナゾロジー（自然科学）",
        "url": "https://nazology.kusuguru.co.jp/archives/category/nature/feed",
    },
}


def parse_target_date(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Invalid date: {value!r}. Use YYYY-MM-DD."
        ) from exc


def fetch_url(url: str, timeout: int = 30) -> bytes:
    """Fetch URL with urllib first, fall back to direct-IP HTTPS on failure.

    The fallback handles environments where local DNS resolves the host to
    127.0.0.1 (sinkhole / pi-hole / hosts override). It uses CDN IPs from
    FALLBACK_IPS with the original Host header preserved for SNI/routing.
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError) as primary_exc:
        host = urllib.parse.urlparse(url).hostname or ""
        ips = FALLBACK_IPS.get(host)
        if not ips:
            raise primary_exc
        path = urllib.parse.urlparse(url).path or "/"
        query = urllib.parse.urlparse(url).query
        if query:
            path = f"{path}?{query}"
        last_err: Exception = primary_exc
        for ip in ips:
            try:
                ctx = ssl.create_default_context()
                raw_sock = socket.create_connection((ip, 443), timeout=timeout)
                tls_sock = ctx.wrap_socket(raw_sock, server_hostname=host)
                conn = http.client.HTTPConnection(host, 443, timeout=timeout)
                conn.sock = tls_sock
                conn.request(
                    "GET",
                    path,
                    headers={"Host": host, "User-Agent": USER_AGENT, "Accept": "*/*"},
                )
                resp = conn.getresponse()
                if 300 <= resp.status < 400:
                    redirect = resp.getheader("Location")
                    conn.close()
                    if redirect and redirect.startswith("http"):
                        return fetch_url(redirect, timeout=timeout)
                    last_err = OSError(f"redirect without Location from {ip}")
                    continue
                if resp.status != 200:
                    last_err = OSError(f"HTTP {resp.status} from {ip}")
                    conn.close()
                    continue
                data = resp.read()
                conn.close()
                return data
            except (OSError, socket.gaierror, ssl.SSLError, http.client.HTTPException) as exc:
                last_err = exc
                continue
        raise last_err


def clean_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return " ".join(unescape(text).split())


def extract_date(item: ET.Element) -> str | None:
    """Return ISO date (YYYY-MM-DD) for an RSS/Atom item, or None."""
    candidates: list[str] = []
    for tag in (
        f"{{{NS['dc']}}}date",
        f"{{{NS['prism']}}}coverDate",
        f"{{{NS['prism']}}}coverDisplayDate",
    ):
        node = item.find(tag)
        if node is not None and node.text:
            candidates.append(node.text)
    pubdate = item.find("pubDate")
    if pubdate is not None and pubdate.text:
        candidates.append(pubdate.text)
    updated = item.find(f"{{{NS['atom']}}}updated")
    if updated is not None and updated.text:
        candidates.append(updated.text)

    for raw in candidates:
        iso = parse_any_date(raw)
        if iso:
            return iso
    return None


def parse_any_date(raw: str) -> str | None:
    raw = raw.strip()
    # ISO-like (Atom: 2026-05-08T12:34:56Z)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", raw)
    if m:
        return m.group(1)
    # RFC 822 (RSS pubDate: Thu, 08 May 2026 12:34:56 +0900)
    months = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
        "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
        "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
    }
    m = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", raw)
    if m:
        day, mon, year = m.group(1).zfill(2), months.get(m.group(2)), m.group(3)
        if mon:
            return f"{year}-{mon}-{day}"
    return None


def find_first(item: ET.Element, *tags: str) -> ET.Element | None:
    for tag in tags:
        node = item.find(tag)
        if node is not None:
            return node
    return None


def extract_title_and_link(item: ET.Element) -> tuple[str, str]:
    title_node = find_first(
        item,
        "title",
        f"{{{NS['rss10']}}}title",
        f"{{{NS['atom']}}}title",
        f"{{{NS['dc']}}}title",
    )
    title = (
        clean_text(title_node.text)
        if (title_node is not None and title_node.text)
        else ""
    )

    link = ""
    link_node = find_first(item, "link", f"{{{NS['rss10']}}}link")
    if link_node is not None:
        link = (link_node.text or "").strip() or link_node.get("href", "")
    if not link:
        atom_link = item.find(f"{{{NS['atom']}}}link")
        if atom_link is not None:
            link = atom_link.get("href", "") or (atom_link.text or "").strip()
    if not link:
        prism_url = item.find(f"{{{NS['prism']}}}url")
        if prism_url is not None and prism_url.text:
            link = prism_url.text.strip()
    return title, link


def parse_feed(xml_bytes: bytes) -> list[ET.Element]:
    root = ET.fromstring(xml_bytes)
    # Try in order: plain RSS 2.0 <item>, RSS 1.0 (RDF) namespaced <item>, Atom <entry>
    for selector in (
        ".//item",
        f".//{{{NS['rss10']}}}item",
        f".//{{{NS['atom']}}}entry",
    ):
        items = root.findall(selector)
        if items:
            return items
    return []


def fetch_source(
    source_key: str,
    target_date: dt.date,
) -> tuple[list[dict], list[str]]:
    config = SOURCES[source_key]
    errors: list[str] = []
    target_iso = target_date.isoformat()
    try:
        body = fetch_url(config["url"])
    except (urllib.error.URLError, TimeoutError) as exc:
        return [], [f"{config['label']} fetch failed: {exc}"]
    except Exception as exc:
        return [], [f"{config['label']} unexpected error: {exc}"]

    try:
        items = parse_feed(body)
    except ET.ParseError as exc:
        return [], [f"{config['label']} parse failed: {exc}"]

    records: list[dict] = []
    for item in items:
        date_iso = extract_date(item)
        title, link = extract_title_and_link(item)
        if not title:
            continue
        if date_iso != target_iso:
            continue
        records.append(
            {
                "source": config["label"],
                "source_key": source_key,
                "title": title,
                "url": link,
                "date": date_iso,
            }
        )
    return records, errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Nature/Science/Nazology RSS items for the target day."
    )
    parser.add_argument(
        "--target-date",
        required=True,
        type=parse_target_date,
        help="Exact target day in YYYY-MM-DD.",
    )
    parser.add_argument(
        "--sources",
        default="nature,science,nazology",
        help=(
            "Comma-separated source keys. Default: nature,science,nazology. "
            "Available: nature, science, nazology."
        ),
    )
    args = parser.parse_args()

    requested = [s.strip() for s in args.sources.split(",") if s.strip()]
    unknown = [s for s in requested if s not in SOURCES]
    if unknown:
        print(
            f"Unknown source keys: {unknown}. Available: {sorted(SOURCES)}",
            file=sys.stderr,
        )
        return 2

    all_records: list[dict] = []
    all_errors: list[str] = []
    per_source_counts: dict[str, int] = {}
    for key in requested:
        records, errors = fetch_source(key, args.target_date)
        all_records.extend(records)
        all_errors.extend(errors)
        per_source_counts[key] = len(records)

    payload = {
        "target_date": args.target_date.isoformat(),
        "sources": requested,
        "counts": per_source_counts,
        "errors": all_errors,
        "records": all_records,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
