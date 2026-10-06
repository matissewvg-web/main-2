#!/usr/bin/env python3
"""Turn a .docx, .md or .txt file into one self-contained, book-like HTML page.

    python3 bookify.py mybook.docx                 -> mybook.html next to it
    python3 bookify.py notes.txt -o out.html --title "My Book" --author "Me"

The output is a single .html file (images embedded) with a table of contents,
light/dark mode, adjustable text size and a remembered reading position.
Only .docx needs a third-party package: pip install python-docx
"""

import argparse
import base64
import hashlib
import html
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- blocks
# Every parser produces a flat list of blocks:
#   {"t": "h", "level": 1-3, "html": ..., "kicker": ...}   heading
#   {"t": "p", "html": ...}                                 paragraph
#   {"t": "quote", "html": ...}                             block quote
#   {"t": "list", "ordered": bool, "items": [html, ...]}    list
#   {"t": "table", "rows": [[html, ...], ...]}              table
#   {"t": "img", "src": data-uri, "alt": ...}               image
#   {"t": "break"}                                          scene break

esc = html.escape

CHAPTER_WORDS = (
    r"chapter|hoofdstuk|part|deel|book|boek|prologue|proloog|epilogue|epiloog|"
    r"introduction|inleiding|preface|voorwoord|foreword|afterword|nawoord|"
    r"appendix|bijlage|conclusion|conclusie|interlude|act"
)
CHAPTER_RE = re.compile(rf"^({CHAPTER_WORDS})\b[\s.:\-–—]*([\w.]*)", re.I)
ROMAN_RE = re.compile(r"^[IVXLC]{1,7}\.?$")
NUMBER_RE = re.compile(r"^\d{1,3}\.?$")
SCENE_BREAK_RE = re.compile(r"^\s*([*#~•·]\s*){1,5}$|^\s*(-\s*){3,}$|^\s*(_\s*){3,}$")


def looks_like_heading(text):
    """Guess whether a lone short line is a chapter heading."""
    s = text.strip()
    if not s or len(s) > 80:
        return False
    if CHAPTER_RE.match(s) or ROMAN_RE.match(s) or NUMBER_RE.match(s):
        return True
    letters = [c for c in s if c.isalpha()]
    return (
        len(letters) >= 3
        and all(c.isupper() for c in letters)
        and len(s) <= 60
        and not s.endswith((".", ",", ";"))
    )


def is_bare_label(text):
    """'Chapter 3', 'IV', '12' - a heading that usually has its real title on the next line."""
    s = text.strip()
    m = CHAPTER_RE.match(s)
    if m:
        return len(s) <= len(m.group(0)) + 1
    return bool(ROMAN_RE.match(s) or NUMBER_RE.match(s))


def merge_label_titles(blocks):
    """'Chapter 1' followed by a short title line -> one heading with a kicker."""
    out = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        nxt = blocks[i + 1] if i + 1 < len(blocks) else None
        if (
            b["t"] == "h"
            and not b.get("kicker")
            and is_bare_label(strip_tags(b["html"]))
            and nxt is not None
            and nxt["t"] in ("p", "h")
            and len(strip_tags(nxt["html"])) <= 70
            and not strip_tags(nxt["html"]).rstrip().endswith((".", ",", ";", "?", "!", '"', "”"))
            and (nxt["t"] == "p" or nxt["level"] == b["level"])
        ):
            kicker = re.sub(r"[.:]\s*$", "", b["html"])
            out.append({"t": "h", "level": b["level"], "kicker": kicker, "html": nxt["html"]})
            i += 2
            continue
        out.append(b)
        i += 1
    return out


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s))


# ---------------------------------------------------------------- inline markdown
INLINE_CODE = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"(\*\*|__)(?=\S)(.+?)(?<=\S)\1")
ITALIC = re.compile(r"(?<![\w*])([*_])(?=\S)(.+?)(?<=\S)\1(?![\w*])")
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+|mailto:[^)\s]+)\)")


def inline_md(text):
    s = esc(text, quote=False)
    s = INLINE_CODE.sub(r"<code>\1</code>", s)
    s = LINK.sub(lambda m: f'<a href="{esc(m.group(2))}">{m.group(1)}</a>', s)
    s = BOLD.sub(r"<strong>\2</strong>", s)
    s = ITALIC.sub(r"<em>\2</em>", s)
    return s


# ---------------------------------------------------------------- plain text / markdown
def join_lines(lines, markdown):
    """Re-flow hard-wrapped prose, but keep line breaks for verse/addresses."""
    fmt = inline_md if markdown else (lambda t: esc(t, quote=False))
    lines = [l.strip() for l in lines]
    if len(lines) > 1 and max(len(l) for l in lines) < 55:
        return "<br>".join(fmt(l) for l in lines)
    return fmt(" ".join(lines))


def parse_text(raw, markdown=False):
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").replace("﻿", "")
    chunks = re.split(r"\n\s*\n", raw)
    blocks = []
    meta = {}
    fmt = inline_md if markdown else (lambda t: esc(t, quote=False))

    for chunk in chunks:
        lines = [l for l in chunk.split("\n") if l.strip()]
        if not lines:
            continue
        first = lines[0].strip()

        if SCENE_BREAK_RE.match(chunk.strip()):
            blocks.append({"t": "break"})
            continue

        if markdown:
            m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", first)
            if m:
                level = len(m.group(1))
                if level == 1 and "title" not in meta and not blocks:
                    meta["title"] = m.group(2)
                else:
                    blocks.append({"t": "h", "level": level, "html": inline_md(m.group(2))})
                if len(lines) > 1:
                    blocks.extend(parse_text("\n".join(lines[1:]), True)[0])
                continue
            if all(re.match(r"^\s*([-*+]|\d+[.)])\s+", l) for l in lines):
                ordered = bool(re.match(r"^\s*\d", first))
                items = [inline_md(re.sub(r"^\s*([-*+]|\d+[.)])\s+", "", l)) for l in lines]
                blocks.append({"t": "list", "ordered": ordered, "items": items})
                continue
            if all(l.lstrip().startswith(">") for l in lines):
                inner = [re.sub(r"^\s*>\s?", "", l) for l in lines]
                blocks.append({"t": "quote", "html": join_lines(inner, True)})
                continue
            img = re.match(r"^!\[([^\]]*)\]\((https?://[^)\s]+)\)$", first)
            if img and len(lines) == 1:
                blocks.append({"t": "img", "src": img.group(2), "alt": img.group(1)})
                continue

        if len(lines) == 1 and looks_like_heading(first):
            blocks.append({"t": "h", "level": 1, "html": fmt(first)})
            continue
        if len(lines) == 2 and is_bare_label(first) and len(lines[1].strip()) <= 70:
            kicker = re.sub(r"[.:]\s*$", "", first)
            blocks.append({"t": "h", "level": 1, "kicker": fmt(kicker), "html": fmt(lines[1].strip())})
            continue

        blocks.append({"t": "p", "html": join_lines(lines, markdown)})

    return blocks, meta


# ---------------------------------------------------------------- docx
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
WEB_IMAGES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}
HEADING_STYLE = re.compile(r"(heading|kop|titre|überschrift|encabezado|titolo)\s*(\d)", re.I)


def docx_heading_level(p):
    """Heading level 1-9 from the style name/id or the outline level; 0 if body text."""
    style = p.style
    for name in (style.name or "", style.style_id or "") if style is not None else ():
        m = HEADING_STYLE.search(name)
        if m:
            return int(m.group(2))
    for el in (p._p.pPr, getattr(style, "element", None)):
        if el is None:
            continue
        lvl = el.find(f".//{W}outlineLvl")
        if lvl is not None:
            v = int(lvl.get(f"{W}val", "9"))
            if v < 9:
                return v + 1
    return 0


def docx_is_title(p):
    style = p.style
    names = f"{style.name or ''} {style.style_id or ''}".lower() if style is not None else ""
    return re.search(r"\b(title|titel)\b", names) is not None


def docx_is_subtitle(p):
    style = p.style
    names = f"{style.name or ''} {style.style_id or ''}".lower() if style is not None else ""
    return "subtitle" in names or "ondertitel" in names


def docx_run_html(run, doc):
    parts = []
    for img in run._r.iter(f"{A}blip"):
        rid = img.get(f"{R}embed")
        part = doc.part.related_parts.get(rid) if rid else None
        if part is not None and part.content_type in WEB_IMAGES:
            data = base64.b64encode(part.blob).decode()
            parts.append(("img", f"data:{part.content_type};base64,{data}"))
    text = run.text
    if text:
        s = esc(text, quote=False).replace("\n", "<br>").replace("\t", " ")
        if run.font.superscript:
            s = f"<sup>{s}</sup>"
        if run.font.subscript:
            s = f"<sub>{s}</sub>"
        if run.underline and not run.bold:
            s = f"<u>{s}</u>"
        if run.italic:
            s = f"<em>{s}</em>"
        if run.bold:
            s = f"<strong>{s}</strong>"
        parts.append(("text", s))
    return parts


def docx_paragraph(p, doc):
    """-> (inline html, [image data uris], fully_bold)"""
    out, images = [], []
    texts_bold = []
    items = p.iter_inner_content() if hasattr(p, "iter_inner_content") else p.runs
    for item in items:
        runs = getattr(item, "runs", None)
        href = getattr(item, "url", None) or getattr(item, "address", None)
        if runs is None:
            runs = [item]
            href = None
        chunk = []
        for run in runs:
            for kind, val in docx_run_html(run, doc):
                if kind == "img":
                    images.append(val)
                else:
                    chunk.append(val)
            if run.text.strip():
                texts_bold.append(bool(run.bold))
        s = "".join(chunk)
        if href and re.match(r"^(https?:|mailto:)", href) and s:
            s = f'<a href="{esc(href)}">{s}</a>'
        out.append(s)
    s = "".join(out).strip()
    s = re.sub(r"</strong><strong>|</em><em>", "", s)
    fully_bold = bool(texts_bold) and all(texts_bold)
    return s, images, fully_bold


def docx_list_kind(p, doc):
    """None, 'ul' or 'ol' for a list paragraph."""
    pPr = p._p.pPr
    numPr = pPr.find(f"{W}numPr") if pPr is not None else None
    style_name = (p.style.name or "").lower() if p.style is not None else ""
    if numPr is None:
        if "list bullet" in style_name:
            return "ul"
        if "list number" in style_name:
            return "ol"
        return None
    try:
        num_id = numPr.find(f"{W}numId").get(f"{W}val")
        ilvl_el = numPr.find(f"{W}ilvl")
        ilvl = ilvl_el.get(f"{W}val") if ilvl_el is not None else "0"
        if num_id == "0":
            return None
        numbering = doc.part.numbering_part.element
        num = numbering.find(f"{W}num[@{W}numId='{num_id}']")
        abs_id = num.find(f"{W}abstractNumId").get(f"{W}val")
        absn = numbering.find(f"{W}abstractNum[@{W}abstractNumId='{abs_id}']")
        lvl = absn.find(f"{W}lvl[@{W}ilvl='{ilvl}']")
        fmt = lvl.find(f"{W}numFmt").get(f"{W}val")
        return "ul" if fmt in ("bullet", "none") else "ol"
    except Exception:
        return "ol" if "number" in style_name else "ul"


def parse_docx(path):
    try:
        import docx
    except ImportError:
        sys.exit("Reading .docx needs python-docx:  pip install python-docx")
    from docx.table import Table

    doc = docx.Document(str(path))
    meta = {}
    props = doc.core_properties
    if props.title:
        meta["title"] = props.title
    if props.author and props.author.lower() not in ("python-docx", "author", "user", "unknown"):
        meta["author"] = props.author

    blocks = []
    styled_headings = False
    pending = []  # (html, fully_bold, plain) for paragraphs that might be headings

    for item in doc.iter_inner_content():
        if isinstance(item, Table):
            rows = []
            for row in item.rows:
                cells = []
                for cell in row.cells:
                    cells.append("<br>".join(docx_paragraph(cp, doc)[0] for cp in cell.paragraphs))
                rows.append(cells)
            if rows:
                blocks.append({"t": "table", "rows": rows})
            continue

        p = item
        s, images, fully_bold = docx_paragraph(p, doc)
        plain = strip_tags(s).strip()
        for src in images:
            blocks.append({"t": "img", "src": src, "alt": ""})
        if not plain:
            continue

        if docx_is_title(p) and "title" not in meta and not blocks:
            meta["title"] = plain
            continue
        if docx_is_subtitle(p) and not blocks:
            meta.setdefault("subtitle", plain)
            continue

        level = docx_heading_level(p)
        if level:
            styled_headings = True
            blocks.append({"t": "h", "level": level, "html": s})
            continue

        if SCENE_BREAK_RE.match(plain):
            blocks.append({"t": "break"})
            continue

        kind = docx_list_kind(p, doc)
        if kind:
            last = blocks[-1] if blocks else None
            if last and last["t"] == "list" and last["ordered"] == (kind == "ol"):
                last["items"].append(s)
            else:
                blocks.append({"t": "list", "ordered": kind == "ol", "items": [s]})
            continue

        style_name = (p.style.name or "").lower() if p.style is not None else ""
        if "quote" in style_name or "citaat" in style_name:
            blocks.append({"t": "quote", "html": s})
            continue

        blocks.append({"t": "p", "html": s, "_bold": fully_bold, "_plain": plain})

    # Documents typed without Heading styles: fall back to guessing.
    if not styled_headings:
        for b in blocks:
            if b["t"] == "p" and (
                looks_like_heading(b["_plain"])
                or (b["_bold"] and len(b["_plain"]) <= 70 and not b["_plain"].endswith("."))
            ):
                b["t"], b["level"] = "h", 1
                b["html"] = re.sub(r"^<strong>(.*)</strong>$", r"\1", b["html"])
    for b in blocks:
        b.pop("_bold", None)
        b.pop("_plain", None)
    return blocks, meta


# ---------------------------------------------------------------- normalise
def normalise_levels(blocks):
    """Map whatever heading levels the source used onto h2 (chapter) / h3 / h4."""
    levels = sorted({b["level"] for b in blocks if b["t"] == "h"})
    mapping = {lvl: min(i, 2) for i, lvl in enumerate(levels)}
    for b in blocks:
        if b["t"] == "h":
            b["depth"] = mapping[b["level"]]  # 0 chapter, 1 section, 2 subsection
    return blocks


def detect_lang(blocks):
    words = re.findall(r"[a-zà-ÿ]+", " ".join(strip_tags(b.get("html", "")) for b in blocks[:200]).lower())
    score = {
        "nl": sum(w in {"de", "het", "een", "en", "niet", "van", "dat", "zijn", "ik", "je", "wat"} for w in words),
        "en": sum(w in {"the", "and", "of", "to", "is", "that", "was", "with", "it", "you", "not"} for w in words),
        "de": sum(w in {"der", "die", "und", "das", "nicht", "ist", "ich", "mit", "zu", "ein"} for w in words),
        "fr": sum(w in {"le", "la", "les", "et", "des", "est", "une", "pas", "que", "dans"} for w in words),
    }
    best = max(score, key=score.get)
    return best if score[best] >= 5 else "en"


QUOTES = {
    "en": ("“", "”", "‘", "’"),
    "nl": ("“", "”", "‘", "’"),
    "de": ("„", "“", "‚", "‘"),
    "fr": ("« ", " »", "‘", "’"),
}


def smarten(s, lang):
    """Curly quotes, dashes and ellipses in text nodes only (never inside tags)."""
    dq_open, dq_close, sq_open, sq_close = QUOTES.get(lang, QUOTES["en"])
    out = []
    prev = " "
    for part in re.split(r"(<[^>]+>)", s):
        if part.startswith("<"):
            out.append(part)
            if re.match(r"<br\b", part):
                prev = " "
            continue
        part = html.unescape(part)
        part = part.replace("---", "—").replace("--", "—").replace("...", "…")
        chars = []
        for ch in part:
            if ch == '"':
                ch = dq_open if (prev.isspace() or prev in "([{—–-/") else dq_close
            elif ch == "'":
                ch = sq_open if (prev.isspace() or prev in "([{—–-/\"“„") else sq_close
            chars.append(ch)
            prev = ch
        out.append(esc("".join(chars), quote=False))
    return "".join(out)


def slugify(text, used):
    base = re.sub(r"[^\w]+", "-", text.lower()).strip("-")[:50] or "section"
    slug, n = base, 2
    while slug in used:
        slug, n = f"{base}-{n}", n + 1
    used.add(slug)
    return slug


# ---------------------------------------------------------------- render
def render_body(blocks, lang):
    out, toc, used = [], [], set()
    after_heading = True
    open_chapter = False

    for b in blocks:
        t = b["t"]
        if t == "h":
            depth = b["depth"]
            text_html = smarten(b["html"], lang)
            kicker = smarten(b["kicker"], lang) if b.get("kicker") else ""
            plain = strip_tags(text_html)
            toc_label = f"{strip_tags(kicker)} · {plain}" if kicker else plain
            slug = slugify(strip_tags(kicker) + " " + plain if kicker else plain, used)
            toc.append((depth, slug, toc_label))
            if depth == 0:
                if open_chapter:
                    out.append("</section>")
                out.append('<section class="chapter">')
                open_chapter = True
            tag = f"h{depth + 2}"
            kick = f'<span class="kicker">{kicker}</span>' if kicker else ""
            out.append(f'<{tag} id="{slug}">{kick}{text_html}</{tag}>')
            after_heading = True
            continue

        if t == "p":
            cls = ' class="first"' if after_heading else ""
            out.append(f"<p{cls}>{smarten(b['html'], lang)}</p>")
            after_heading = False
        elif t == "quote":
            out.append(f"<blockquote><p>{smarten(b['html'], lang)}</p></blockquote>")
            after_heading = True
        elif t == "list":
            tag = "ol" if b["ordered"] else "ul"
            items = "".join(f"<li>{smarten(i, lang)}</li>" for i in b["items"])
            out.append(f"<{tag}>{items}</{tag}>")
            after_heading = True
        elif t == "table":
            rows = []
            for i, row in enumerate(b["rows"]):
                cell = "th" if i == 0 and len(b["rows"]) > 1 else "td"
                rows.append("<tr>" + "".join(f"<{cell}>{smarten(c, lang)}</{cell}>" for c in row) + "</tr>")
            out.append('<div class="table-wrap"><table>' + "".join(rows) + "</table></div>")
            after_heading = True
        elif t == "img":
            out.append(f'<figure><img src="{esc(b["src"])}" alt="{esc(b["alt"])}" loading="lazy"></figure>')
            after_heading = True
        elif t == "break":
            out.append('<hr class="scene">')
            after_heading = True

    if open_chapter:
        out.append("</section>")
    return "\n".join(out), toc


def render_toc(toc):
    if not toc:
        return ""
    items = []
    for depth, slug, label in toc:
        items.append(f'<li class="d{depth}"><a href="#{slug}">{esc(label, quote=False)}</a></li>')
    return "<ol>" + "".join(items) + "</ol>"


def build_html(blocks, meta, lang):
    blocks = normalise_levels(merge_label_titles(blocks))
    body, toc = render_body(blocks, lang)
    title = meta.get("title") or "Untitled"
    words = len(re.findall(r"\w+", strip_tags(body)))
    minutes = max(1, round(words / 230))
    toc_html = render_toc(toc)
    book_id = hashlib.sha1((title + str(words)).encode()).hexdigest()[:10]

    subtitle = f'<p class="subtitle">{esc(meta["subtitle"])}</p>' if meta.get("subtitle") else ""
    author = f'<p class="author">{esc(meta["author"])}</p>' if meta.get("author") else ""
    show_toc_inline = sum(1 for d, _, _ in toc if d == 0) >= 2
    inline_toc = (
        f'<nav class="toc-inline" aria-label="Contents"><h2 class="toc-title">Contents</h2>{toc_html}</nav>'
        if show_toc_inline
        else ""
    )
    hours = f"{minutes // 60} h {minutes % 60} min" if minutes >= 60 else f"{minutes} min"

    return (
        TEMPLATE.replace("{{LANG}}", lang)
        .replace("{{TITLE}}", esc(title))
        .replace("{{BOOK_ID}}", book_id)
        .replace("{{SUBTITLE}}", subtitle)
        .replace("{{AUTHOR}}", author)
        .replace("{{META}}", f"{words:,} words · about {hours} reading")
        .replace("{{TOC_INLINE}}", inline_toc)
        .replace("{{TOC}}", toc_html or "<p>No chapters found.</p>")
        .replace("{{TOC_BUTTON}}", "" if toc else " hidden")
        .replace("{{BODY}}", body)
    )


TEMPLATE = r"""<!doctype html>
<html lang="{{LANG}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>{{TITLE}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap" rel="stylesheet">
<script>
  // Set theme and size before first paint so the page never flashes.
  (function () {
    var d = document.documentElement;
    try {
      var t = localStorage.getItem("bookify-theme");
      if (t === "light" || t === "dark") d.dataset.theme = t;
      var s = parseFloat(localStorage.getItem("bookify-size"));
      if (s >= 0.8 && s <= 1.6) d.style.setProperty("--scale", s);
    } catch (e) {}
  })();
</script>
<style>
  :root {
    --scale: 1;
    --bg: #f8f4ec;
    --text: #2a2521;
    --muted: #6f655b;
    --accent: #8c5a2b;
    --rule: #e3dacb;
    --panel: #fffdf8;
    --shadow: 0 10px 40px rgba(60, 40, 20, .18);
    --serif: "Literata", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  :root[data-theme="dark"] {
    --bg: #1b1916;
    --text: #d8d0c3;
    --muted: #958b7e;
    --accent: #d0a46e;
    --rule: #34302a;
    --panel: #24211d;
    --shadow: 0 10px 40px rgba(0, 0, 0, .5);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #1b1916;
      --text: #d8d0c3;
      --muted: #958b7e;
      --accent: #d0a46e;
      --rule: #34302a;
      --panel: #24211d;
      --shadow: 0 10px 40px rgba(0, 0, 0, .5);
    }
  }

  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; scroll-padding-top: 4rem; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--serif);
    font-size: calc(1.125rem * var(--scale));
    line-height: 1.65;
    font-optical-sizing: auto;
    text-rendering: optimizeLegibility;
    font-kerning: normal;
    font-variant-ligatures: common-ligatures;
    transition: background-color .25s, color .25s;
  }
  main {
    max-width: 34em;
    margin: 0 auto;
    padding: 5rem max(1rem, env(safe-area-inset-left)) 6rem;
    overflow-wrap: break-word;
  }

  /* title page */
  .titlepage { text-align: center; padding: 12vh 0 10vh; }
  .titlepage h1 {
    font-size: 2.3em; line-height: 1.15; font-weight: 600;
    margin: 0 0 .4em; letter-spacing: -.01em; text-wrap: balance;
  }
  .subtitle { font-style: italic; font-size: 1.15em; color: var(--muted); margin: 0 0 1.6em; }
  .author { font-variant: small-caps; letter-spacing: .08em; font-size: 1.1em; margin: 0 0 2.4em; }
  .meta { font-family: var(--sans); font-size: .72em; color: var(--muted); letter-spacing: .04em; }
  .titlepage::after { content: "❦"; display: block; margin-top: 2.5em; color: var(--accent); font-size: 1.4em; }

  .toc-inline { margin: 0 0 4rem; padding-bottom: 3rem; border-bottom: 1px solid var(--rule); }
  .toc-title { text-align: center; font-variant: small-caps; letter-spacing: .12em; font-weight: 400; font-size: 1.1em; }

  /* body text */
  .chapter { padding-top: 3rem; }
  .chapter + .chapter { margin-top: 3rem; }
  h2, h3, h4 { font-weight: 600; line-height: 1.25; text-wrap: balance; }
  h2 { font-size: 1.6em; text-align: center; margin: 0 0 2em; }
  h2::after {
    content: ""; display: block; width: 2.5rem; height: 1px;
    background: var(--accent); margin: .9em auto 0; opacity: .7;
  }
  h3 { font-size: 1.2em; margin: 2.2em 0 .8em; }
  h4 { font-size: 1em; font-style: italic; font-weight: 400; margin: 1.8em 0 .6em; }
  .kicker {
    display: block; font-weight: 400; font-size: .55em; color: var(--muted);
    font-variant: small-caps; letter-spacing: .14em; margin-bottom: .6em;
  }
  h3 .kicker, h4 .kicker { font-size: .7em; }

  p { margin: 0; text-indent: 1.4em; hyphens: auto; -webkit-hyphens: auto; }
  p.first, blockquote p, li p, td p { text-indent: 0; }
  .chapter > h2 + p.first::first-line { font-variant: small-caps; letter-spacing: .04em; }

  a { color: var(--accent); text-underline-offset: .15em; }
  blockquote {
    margin: 1.4em 0; padding: 0 0 0 1.2em;
    border-left: 2px solid var(--rule); font-style: italic; color: var(--muted);
  }
  ul, ol { margin: 1em 0; padding-left: 1.6em; }
  li { margin: .25em 0; }
  hr.scene { border: 0; margin: 2em 0; text-align: center; height: 1.6em; }
  hr.scene::before { content: "⁂"; color: var(--accent); font-size: 1.1em; }
  figure { margin: 2em 0; text-align: center; }
  figure img { max-width: 100%; height: auto; border-radius: 3px; }
  .table-wrap { overflow-x: auto; margin: 1.5em 0; }
  table { border-collapse: collapse; font-size: .85em; width: 100%; }
  th, td { border-bottom: 1px solid var(--rule); padding: .45em .6em; text-align: left; vertical-align: top; }
  th { font-weight: 600; }
  code { font-size: .88em; background: var(--rule); padding: .05em .3em; border-radius: 3px; }
  .end { text-align: center; color: var(--accent); margin-top: 4rem; font-size: 1.4em; }

  /* contents list (inline and in the drawer) */
  nav ol, #toc ol { list-style: none; padding: 0; margin: 0; }
  nav li, #toc li { margin: 0; text-indent: 0; }
  nav a, #toc a {
    display: block; padding: .5em .25em; color: var(--text);
    text-decoration: none; border-bottom: 1px solid var(--rule); line-height: 1.35;
  }
  nav a:hover, #toc a:hover, #toc a.current { color: var(--accent); }
  .d1 a { padding-left: 1.4em; font-size: .92em; }
  .d2 a { padding-left: 2.6em; font-size: .85em; color: var(--muted); }

  /* reading tools */
  #progress {
    position: fixed; top: 0; left: 0; height: 2px; width: 0;
    background: var(--accent); z-index: 20; transition: width .1s linear;
  }
  #bar {
    position: fixed; top: max(.5rem, env(safe-area-inset-top)); right: .5rem; z-index: 10;
    display: flex; gap: .25rem; padding: .25rem; border-radius: 999px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    box-shadow: 0 1px 6px rgba(0,0,0,.12);
    transition: transform .25s, opacity .25s;
  }
  #bar.hide { transform: translateY(-150%); opacity: 0; }
  #bar button {
    width: 44px; height: 44px; border: 0; border-radius: 999px; background: transparent;
    color: var(--text); cursor: pointer; display: grid; place-items: center;
    font: 600 15px/1 var(--sans);
  }
  #bar button:hover { background: var(--rule); }
  #bar button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  #bar svg { width: 20px; height: 20px; }
  .small-a { font-size: 12px; }

  #toc {
    border: 0; padding: 0; margin: 0 0 0 auto; height: 100%; max-height: 100%;
    width: min(24rem, 88vw); background: var(--panel); color: var(--text);
    box-shadow: var(--shadow); font-family: var(--serif);
  }
  #toc::backdrop { background: rgba(0,0,0,.35); }
  #toc header {
    position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between;
    padding: .75rem 1rem; background: var(--panel); border-bottom: 1px solid var(--rule);
    font-family: var(--sans); font-size: .85rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
  }
  #toc header button {
    width: 44px; height: 44px; border: 0; background: none; color: var(--text);
    font-size: 1.5rem; cursor: pointer; border-radius: 999px;
  }
  #toc .list { padding: .5rem 1rem 2rem; }

  @media (max-width: 480px) {
    body { font-size: calc(1.0625rem * var(--scale)); line-height: 1.6; }
    .titlepage h1 { font-size: 1.9em; }
    h2 { font-size: 1.4em; }
  }
  @media print {
    #bar, #progress, #toc { display: none !important; }
    body { background: #fff; color: #000; font-size: 11pt; }
    main { padding: 0; max-width: none; }
    .chapter { break-before: page; }
    a { color: inherit; text-decoration: none; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div id="progress" aria-hidden="true"></div>

<div id="bar" role="toolbar" aria-label="Reading options">
  <button id="btn-toc" type="button" aria-label="Contents" title="Contents"{{TOC_BUTTON}}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
  </button>
  <button id="btn-smaller" type="button" aria-label="Smaller text" title="Smaller text"><span class="small-a">A</span></button>
  <button id="btn-bigger" type="button" aria-label="Larger text" title="Larger text">A</button>
  <button id="btn-theme" type="button" aria-label="Switch light or dark" title="Light / dark">
    <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>
</div>

<dialog id="toc" aria-label="Contents">
  <header>Contents <button type="button" id="toc-close" aria-label="Close">×</button></header>
  <div class="list">{{TOC}}</div>
</dialog>

<main>
  <header class="titlepage">
    <h1>{{TITLE}}</h1>
    {{SUBTITLE}}
    {{AUTHOR}}
    <p class="meta">{{META}}</p>
  </header>
  {{TOC_INLINE}}
  <article>
{{BODY}}
  </article>
  <p class="end" aria-hidden="true">❦</p>
</main>

<script>
(function () {
  var root = document.documentElement;
  var KEY = "bookify-pos-{{BOOK_ID}}";
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Theme: explicit choice wins, otherwise follow the device.
  var dark = matchMedia("(prefers-color-scheme: dark)");
  function isDark() { return root.dataset.theme ? root.dataset.theme === "dark" : dark.matches; }
  function paintIcon() {
    var d = isDark();
    document.querySelector(".i-sun").style.display = d ? "" : "none";
    document.querySelector(".i-moon").style.display = d ? "none" : "";
  }
  document.getElementById("btn-theme").onclick = function () {
    root.dataset.theme = isDark() ? "light" : "dark";
    save("bookify-theme", root.dataset.theme);
    paintIcon();
  };
  dark.addEventListener && dark.addEventListener("change", paintIcon);
  paintIcon();

  // Text size.
  function scale(delta) {
    var s = parseFloat(getComputedStyle(root).getPropertyValue("--scale")) || 1;
    s = Math.min(1.6, Math.max(0.8, Math.round((s + delta) * 100) / 100));
    var anchor = topElement();
    root.style.setProperty("--scale", s);
    save("bookify-size", s);
    if (anchor) anchor.scrollIntoView();
  }
  document.getElementById("btn-smaller").onclick = function () { scale(-0.1); };
  document.getElementById("btn-bigger").onclick = function () { scale(0.1); };

  // Contents drawer.
  var toc = document.getElementById("toc");
  document.getElementById("btn-toc").onclick = function () {
    markCurrent();
    if (toc.showModal) toc.showModal(); else toc.setAttribute("open", "");
    var cur = toc.querySelector("a.current");
    if (cur) cur.scrollIntoView({ block: "center" });
  };
  document.getElementById("toc-close").onclick = function () { toc.close ? toc.close() : toc.removeAttribute("open"); };
  toc.addEventListener("click", function (e) {
    if (e.target === toc || e.target.closest("a")) { toc.close ? toc.close() : toc.removeAttribute("open"); }
  });

  var heads = Array.prototype.slice.call(document.querySelectorAll("article h2, article h3, article h4"));
  function markCurrent() {
    var current = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top < 120) current = heads[i]; else break;
    }
    toc.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("current", !!current && a.getAttribute("href") === "#" + current.id);
    });
  }

  // Paragraph at the top of the screen, used to keep your place.
  var paras = Array.prototype.slice.call(document.querySelectorAll("article > *, article section > *"));
  function topElement() {
    var lo = 0, hi = paras.length - 1, best = null;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (paras[mid].getBoundingClientRect().bottom > 0) { best = paras[mid]; hi = mid - 1; } else lo = mid + 1;
    }
    return best;
  }

  // Progress bar, auto-hiding toolbar, remembered position.
  var bar = document.getElementById("bar"), progress = document.getElementById("progress");
  var lastY = scrollY, ticking = false, saveTimer;
  function onScroll() {
    var max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    if (scrollY > lastY + 8 && scrollY > 200) bar.classList.add("hide");
    else if (scrollY < lastY - 8 || scrollY < 200) bar.classList.remove("hide");
    lastY = scrollY;
    ticking = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var el = topElement();
      if (!el) return;
      var r = el.getBoundingClientRect();
      save(KEY, paras.indexOf(el) + ":" + (r.height ? Math.max(0, -r.top) / r.height : 0).toFixed(3));
    }, 400);
  }
  addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#bar, #toc, a, button")) bar.classList.toggle("hide");
  });

  if (!location.hash) {
    var pos = (load(KEY) || "").split(":");
    var idx = parseInt(pos[0], 10), frac = parseFloat(pos[1]) || 0;
    if (idx >= 0 && paras[idx] && (idx > 0 || frac > 0)) {
      var go = function () {
        var r = paras[idx].getBoundingClientRect();
        scrollTo(0, scrollY + r.top + frac * r.height);
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    }
  }
  onScroll();
})();
</script>
</body>
</html>
"""


# ---------------------------------------------------------------- cli
def convert(src, title=None, author=None, lang=None):
    src = Path(src)
    ext = src.suffix.lower()
    if ext == ".docx":
        try:
            blocks, meta = parse_docx(src)
        except SystemExit:
            raise
        except Exception as e:
            sys.exit(f"Could not read {src.name} as a Word file ({e}). "
                     "Save it as .txt from Word and try that instead.")
    elif ext in (".md", ".markdown"):
        blocks, meta = parse_text(src.read_text(encoding="utf-8", errors="replace"), markdown=True)
    elif ext in (".txt", ".text", ""):
        blocks, meta = parse_text(src.read_text(encoding="utf-8", errors="replace"))
    else:
        sys.exit(f"Unsupported file type '{ext}'. Use .docx, .md or .txt.")

    if not blocks:
        sys.exit(f"No text found in {src.name}.")
    stem = re.sub(r"[_-]+", " ", src.stem).strip()
    meta.setdefault("title", (stem.title() if stem.islower() else stem) or "Untitled")
    if title:
        meta["title"] = title
    if author:
        meta["author"] = author
    lang = lang or detect_lang(blocks)
    return build_html(blocks, meta, lang)


def main():
    ap = argparse.ArgumentParser(description="Turn a .docx/.md/.txt into a book-like HTML page.")
    ap.add_argument("input", help="the .docx, .md or .txt file")
    ap.add_argument("-o", "--output", help="output .html path (default: next to the input)")
    ap.add_argument("--title", help="override the book title")
    ap.add_argument("--author", help="author shown on the title page")
    ap.add_argument("--lang", help="language code for hyphenation and quotes, e.g. en, nl (default: guessed)")
    args = ap.parse_args()

    src = Path(args.input)
    if not src.is_file():
        sys.exit(f"File not found: {src}")
    out = Path(args.output) if args.output else src.with_suffix(".html")
    if out.resolve() == src.resolve():
        sys.exit("Output would overwrite the input; pass -o.")
    out.write_text(convert(src, args.title, args.author, args.lang), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
