#!/usr/bin/env python3
"""Render a daily-search-trend Markdown file to standalone HTML."""

from __future__ import annotations

import argparse
import html
import re
from datetime import datetime
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
CSS_PATH = SKILL_DIR / "assets" / "newsprint-trend.css"


def inline_md(text: str) -> str:
    placeholders: dict[str, str] = {}

    def stash(value: str) -> str:
        key = f"\u0000{len(placeholders)}\u0000"
        placeholders[key] = value
        return key

    escaped = html.escape(text, quote=False)

    def code_repl(match: re.Match[str]) -> str:
        return stash(f"<code>{match.group(1)}</code>")

    escaped = re.sub(r"`([^`]+)`", code_repl, escaped)

    def link_repl(match: re.Match[str]) -> str:
        label = match.group(1)
        url = html.escape(match.group(2), quote=True)
        return stash(f'<a href="{url}">{label}</a>')

    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_repl, escaped)
    escaped = re.sub(r"&lt;(https?://[^&]+)&gt;", lambda m: stash(f'<a href="{m.group(1)}">{m.group(1)}</a>'), escaped)

    for key, value in placeholders.items():
        escaped = escaped.replace(key, value)
    return escaped


def is_table_separator(line: str) -> bool:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_blocks(lines: list[str]) -> str:
    out: list[str] = []
    i = 0
    in_ul = False
    in_ol = False
    in_code = False
    code_buf: list[str] = []

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    while i < len(lines):
        line = lines[i].rstrip("\n")

        if in_code:
            if line.startswith("```"):
                out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
                code_buf = []
                in_code = False
            else:
                code_buf.append(line)
            i += 1
            continue

        if line.startswith("```"):
            close_lists()
            in_code = True
            code_buf = []
            i += 1
            continue

        if not line.strip():
            close_lists()
            i += 1
            continue

        if line.lstrip().startswith("|") and i + 1 < len(lines) and is_table_separator(lines[i + 1]):
            close_lists()
            headers = split_table_row(line)
            i += 2
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(split_table_row(lines[i]))
                i += 1
            out.append('<div class="table-wrap"><table>')
            out.append("<thead><tr>" + "".join(f"<th>{inline_md(h)}</th>" for h in headers) + "</tr></thead>")
            out.append("<tbody>")
            for row in rows:
                padded = row + [""] * max(0, len(headers) - len(row))
                out.append("<tr>" + "".join(f"<td>{inline_md(c)}</td>" for c in padded[: len(headers)]) + "</tr>")
            out.append("</tbody></table></div>")
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            close_lists()
            level = len(heading.group(1))
            out.append(f"<h{level}>{inline_md(heading.group(2).strip())}</h{level}>")
            i += 1
            continue

        if re.match(r"^\s*[-*]\s+", line):
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            item = re.sub(r"^\s*[-*]\s+", "", line)
            out.append(f"<li>{inline_md(item)}</li>")
            i += 1
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            item = re.sub(r"^\s*\d+\.\s+", "", line)
            out.append(f"<li>{inline_md(item)}</li>")
            i += 1
            continue

        close_lists()
        out.append(f"<p>{inline_md(line.strip())}</p>")
        i += 1

    close_lists()
    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
    return "\n".join(out)


def render(markdown_path: Path, output_path: Path) -> None:
    markdown = markdown_path.read_text(encoding="utf-8")
    css = CSS_PATH.read_text(encoding="utf-8")
    title = "Daily Search Trend"
    for line in markdown.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            break
    body = parse_blocks(markdown.splitlines())
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    doc = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
{css}
  </style>
</head>
<body>
  <main id="write">
{body}
    <p class="generated-meta">Generated from {html.escape(markdown_path.name)} at {generated}.</p>
  </main>
</body>
</html>
"""
    output_path.write_text(doc, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()
    output = args.output or args.markdown.with_suffix(".html")
    render(args.markdown, output)
    print(output)


if __name__ == "__main__":
    main()
