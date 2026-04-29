#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path
import re


CANDIDATES = {
    "springer": (re.compile(r'<div[^>]*data-article-body="true"[^>]*class="[^"]*c-article-body[^"]*"[^>]*>', re.IGNORECASE), "div"),
    "plos": (re.compile(r'<div[^>]*id="artText"[^>]*>', re.IGNORECASE), "div"),
    "article": (re.compile(r'<article\b[^>]*>', re.IGNORECASE), "article"),
    "main-content": (re.compile(r'<main\b[^>]*id="main-content"[^>]*>', re.IGNORECASE), "main"),
    "main": (re.compile(r'<main\b[^>]*>', re.IGNORECASE), "main"),
}
AUTO_ORDER = ["springer", "plos", "article", "main-content", "main"]
REMOVE_PATTERNS = [
    re.compile(r'<div class="c-article-section__figure-link">.*?</div>', re.DOTALL),
    re.compile(r'<span class="u-visually-hidden".*?</span>', re.DOTALL),
    re.compile(r'<div class="u-text-right u-hide-print">.*?</div>', re.DOTALL),
    re.compile(r'<section[^>]*data-title="Rights and permissions".*', re.DOTALL),
    re.compile(r'<ul class="reflinks">.*?</ul>', re.DOTALL),
]
STYLE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    :root {{
      --bg-color: #f3f2ee;
      --text-color: #1f0909;
      --muted-color: #656565;
      --rule-color: #c5c5c5;
      --table-head-bg: #dadada;
      --table-alt-bg: #e8e7e7;
      --code-bg: #dadada;
      --link-color: #065588;
      --note-bg: #ece7da;
    }}
    html {{ font-size: 16px; -webkit-font-smoothing: antialiased; }}
    body {{
      margin: 0;
      background: var(--bg-color);
      color: var(--text-color);
      font-family: "PT Serif", Georgia, "Times New Roman", "Hiragino Mincho ProN", "Yu Mincho", serif;
      line-height: 1.5;
    }}
    #write {{ box-sizing: border-box; max-width: 914px; margin: 0 auto; padding: 48px 24px 72px; }}
    @media (max-width: 720px) {{ #write {{ padding: 28px 16px 48px; }} }}
    h1, h2, h3, h4, h5, h6 {{ font-weight: bold; }}
    h1 {{ margin: 1.8em 0 0.7em; padding-bottom: 0.65em; border-bottom: 1px solid var(--rule-color); font-size: 1.875em; line-height: 1.3; font-weight: normal; }}
    h2, h3 {{ margin-top: 2.2em; margin-bottom: 0.75em; font-size: 1.3125em; line-height: 1.15; }}
    h3 {{ font-weight: normal; }}
    h4 {{ margin-top: 2.4em; font-size: 1.125em; }}
    p, blockquote, table, pre, ul, ol, figure {{ margin-bottom: 1.5em; }}
    a {{ color: var(--link-color); text-decoration: none; }}
    a:hover, a:active {{ text-decoration: underline; }}
    blockquote {{ margin-left: 2em; padding-left: 1em; border-left: 5px solid #bababa; color: var(--muted-color); font-style: italic; }}
    ul, ol {{ margin-left: 1.5em; padding-left: 0; }}
    ul li {{ list-style-type: disc; list-style-position: outside; }}
    ol li {{ list-style-type: decimal; list-style-position: outside; }}
    img {{ max-width: 100%; height: auto; display:block; margin: 0.75em auto; }}
    .meta {{ margin: 0 0 1.5em; padding: 1em 1.1em; background: var(--note-bg); border: 1px solid var(--rule-color); color: var(--muted-color); font-size: 0.95rem; }}
    .abstract-content, .articleinfo {{ margin-bottom: 1.5em; padding: 0.9em 1.05em; background: #f8f7f2; border: 1px solid var(--rule-color); }}
    .figure {{ padding: 0.85em 1em; border-top: 1px solid var(--rule-color); border-bottom: 1px solid var(--rule-color); }}
    .figcaption {{ color: var(--muted-color); font-size: 0.95rem; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 0.95rem; }}
    th, td {{ border: 1px solid var(--rule-color); padding: 8px 10px; vertical-align: top; }}
    th {{ background: var(--table-head-bg); }}
    tr:nth-child(even) td {{ background: var(--table-alt-bg); }}
    .equation-placeholder {{ display: inline-block; margin: 0.2em 0; padding: 0.15em 0.45em; background: var(--code-bg); color: var(--muted-color); font-size: 0.9rem; }}
    .references {{ padding-left: 1.5rem; }}
    .references li {{ margin-bottom: 0.9rem; }}
  </style>
</head>
<body>
  <div id="write">
    <div class="meta">
      <strong>Clean original</strong>: local reading copy of the full original text with publisher UI removed.
    </div>
    {body}
  </div>
</body>
</html>
"""


def find_matching_tag(raw_html: str, start_idx: int, tag: str) -> str:
    open_match = re.search(rf'<{tag}\b[^>]*>', raw_html[start_idx:], re.IGNORECASE)
    if not open_match:
        raise ValueError(f"Could not find opening <{tag}> tag")
    abs_open_start = start_idx + open_match.start()
    abs_open_end = start_idx + open_match.end()
    token_re = re.compile(rf'<{tag}\b[^>]*>|</{tag}>', re.IGNORECASE)
    depth = 1
    pos = abs_open_end
    while True:
        token = token_re.search(raw_html, pos)
        if not token:
            raise ValueError(f"Could not find matching closing </{tag}> tag")
        text = token.group(0)
        if text.lower().startswith(f'</{tag}'):
            depth -= 1
        else:
            depth += 1
        pos = token.end()
        if depth == 0:
            return raw_html[abs_open_start:token.end()]


def cleanup_body(body: str) -> str:
    for pattern in REMOVE_PATTERNS:
        body = pattern.sub('', body)
    return body


def extract_body(raw_html: str, mode: str = 'auto') -> tuple[str, str]:
    tried = []
    order = AUTO_ORDER if mode == 'auto' else [mode]
    for key in order:
        regex, tag = CANDIDATES[key]
        match = regex.search(raw_html)
        tried.append(key)
        if not match:
            continue
        body = find_matching_tag(raw_html, match.start(), tag)
        body = cleanup_body(body)
        if len(body) > 2000:
            return key, body
    raise ValueError(f"Could not extract article body. Tried modes: {', '.join(tried)}")


def detect_title(raw_html: str, fallback: str) -> str:
    match = re.search(r'<title>(.*?)</title>', raw_html, re.IGNORECASE | re.DOTALL)
    if not match:
        return fallback
    return re.sub(r'\s+', ' ', match.group(1)).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description='Create clean-original.html from raw publisher HTML.')
    parser.add_argument('raw_html', help='Raw HTML file captured from the browser')
    parser.add_argument('output_html', help='Path to write clean-original.html')
    parser.add_argument('--title', default='clean original', help='HTML title override')
    parser.add_argument('--mode', choices=['auto', 'springer', 'plos', 'article', 'main-content', 'main'], default='auto', help='Extraction mode. Use auto first.')
    args = parser.parse_args()

    raw_path = Path(args.raw_html)
    out_path = Path(args.output_html)
    raw_html = raw_path.read_text(encoding='utf-8')
    used_mode, body = extract_body(raw_html, args.mode)
    title = detect_title(raw_html, args.title)
    output = STYLE.format(title=title, body=body)
    out_path.write_text(output, encoding='utf-8')
    print(f'wrote {out_path} using mode={used_mode}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
