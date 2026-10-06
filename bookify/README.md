# Bookify

Turns a `.docx`, `.md` or `.txt` file into one self-contained HTML page that reads like a book: serif type, a title page, chapters, a contents drawer, light/dark mode and adjustable text size. It remembers your theme, text size and where you stopped reading.

```
pip install python-docx          # only needed for .docx
python3 bookify.py mybook.docx   # writes mybook.html next to it
python3 bookify.py notes.txt -o book.html --title "My Book" --author "Me" --lang nl
```

Open the `.html` on any device. To read on a phone, send yourself the file (AirDrop, email, cloud drive) and open it in the browser. Images are embedded, so the single file is all you need.

## How chapters are found

- **.docx**: Word's *Heading 1/2/3* styles (Dutch *Kop 1/2/3* and other languages work too). *Title* and *Subtitle* styles (or custom ones like *BookTitle*/*BookSub*) become the title page. A typed contents list (TOC/Contents styles) is dropped and rebuilt, since page numbers mean nothing here. If the document has no heading styles, short bold lines and lines like "Chapter 3", "Hoofdstuk 3", "IV" or ALL CAPS become chapters.
- **.md**: `#` headings. A lone `# Title` at the top becomes the book title.
- **.txt**: the same guessing as unstyled Word files. Paragraphs are separated by blank lines. Hard-wrapped lines are re-joined, while blocks of short lines (verse, addresses) keep their line breaks.

"Chapter 1" followed by a short title line (or `CHAPTER 1⏎Title` and `Part One: Title` inside one heading) becomes a small label above the title. ALL CAPS headings are set in title case. If every top-level heading is a "Part …" or "Book …", those get their own part page and the level below them becomes the chapters.

A quote styled *Quote*, *Block Text* or *Epigraph* right after a chapter heading becomes an epigraph, with "— Source" split off as its attribution. `* * *`, `***` or `---` on its own line becomes a scene break, and lines like "END OF CHAPTER ONE" become a small end ornament.

## Known limits

- Footnotes, comments, text boxes, headers/footers and tracked changes in .docx are dropped.
- Only PNG, JPEG, GIF, WebP and SVG images are kept; old Word drawings (EMF/WMF) are skipped.
- Heading detection in unstyled files is a guess. If it picks the wrong lines, apply Heading styles in Word, or use `#` headings in a .md file.
- The Literata font loads from Google Fonts. Offline, the page falls back to the device's built-in serif font.
- Position and preferences are stored in the browser (`localStorage`), so they don't sync between devices and may be lost in private browsing.
