#!/usr/bin/env python3
"""Push a daily lab-OS research-trend digest (Markdown) to the lab-OS ingest API.

Reads the token/URL from the environment (source ~/.config/life/labos.env first):
  LABOS_URL           default https://ymir.tail175f64.ts.net
  LABOS_INGEST_TOKEN  required (must match ymir's .env LABOS_INGEST_TOKEN)

Usage:
  python3 push_trend.py --date 2026-09-10 --highlight "一行ハイライト" --md /tmp/trend.md
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="YYYY-MM-DD")
    ap.add_argument("--highlight", default="", help="1-line highlight (JP) shown in お知らせ")
    ap.add_argument("--md", required=True, help="path to the Markdown body (JP)")
    ap.add_argument("--highlight-en", default="")
    ap.add_argument("--md-en", default="", help="optional path to EN Markdown body")
    ap.add_argument("--url", default=os.environ.get("LABOS_URL", "https://ymir.tail175f64.ts.net"))
    a = ap.parse_args()

    token = os.environ.get("LABOS_INGEST_TOKEN", "")
    if not token:
        print("LABOS_INGEST_TOKEN not set (source ~/.config/life/labos.env)", file=sys.stderr)
        return 2
    body_ja = open(a.md, encoding="utf-8").read()
    payload = {"date": a.date, "highlight_ja": a.highlight, "body_md_ja": body_ja}
    if a.highlight_en:
        payload["highlight_en"] = a.highlight_en
    if a.md_en and os.path.exists(a.md_en):
        payload["body_md_en"] = open(a.md_en, encoding="utf-8").read()

    req = urllib.request.Request(
        a.url.rstrip("/") + "/api/trend/ingest",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "X-Labos-Ingest-Token": token},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(r.status, r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode("utf-8", "replace"), file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print("URLError", e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
