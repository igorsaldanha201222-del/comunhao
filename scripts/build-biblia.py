"""Gera apps/web/public/biblia/blivre/<livro>.json a partir do arquivo VPL do eBible.org.

Fonte: Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio e Marco Teles,
CC BY 4.0 BR — https://ebible.org/Scriptures/porbr2018_vpl.zip
Uso: python scripts/build-biblia.py caminho/porbr2018_vpl.txt
"""
import json, os, re, sys

# código VPL -> slug usado na URL (abreviação brasileira)
CODES = "GEN:gn EXO:ex LEV:lv NUM:nm DEU:dt JOS:js JDG:jz RUT:rt 1SA:1sm 2SA:2sm 1KI:1rs 2KI:2rs 1CH:1cr 2CH:2cr EZR:ed NEH:ne EST:et JOB:jo PSA:sl PRO:pv ECC:ec SOL:ct ISA:is JER:jr LAM:lm EZE:ez DAN:dn HOS:os JOE:jl AMO:am OBA:ob JON:jn MIC:mq NAH:na HAB:hc ZEP:sf HAG:ag ZEC:zc MAL:ml MAT:mt MAR:mc LUK:lc JOH:joa ACT:at ROM:rm 1CO:1co 2CO:2co GAL:gl EPH:ef PHI:fp COL:cl 1TH:1ts 2TH:2ts 1TI:1tm 2TI:2tm TIT:tt PHM:fm HEB:hb JAM:tg 1PE:1pe 2PE:2pe 1JO:1jo 2JO:2jo 3JO:3jo JUD:jd REV:ap"
MAP = dict(x.split(":") for x in CODES.split())

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "biblia", "blivre")
os.makedirs(out, exist_ok=True)
books: dict[str, list[list[str]]] = {}
line_re = re.compile(r"^(\w{3}) (\d+):(\d+) (.*)$")
for line in open(src, encoding="utf-8"):
    m = line_re.match(line.rstrip("\n"))
    if not m or m.group(1) not in MAP:
        continue
    code, ch, v, text = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4).strip()
    chapters = books.setdefault(MAP[code], [])
    while len(chapters) < ch:
        chapters.append([])
    verses = chapters[ch - 1]
    while len(verses) < v - 1:
        verses.append("")
    verses.append(text)

for slug, chapters in books.items():
    with open(os.path.join(out, f"{slug}.json"), "w", encoding="utf-8") as f:
        json.dump(chapters, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(books)} livros, {sum(len(c) for c in books.values())} capítulos")
