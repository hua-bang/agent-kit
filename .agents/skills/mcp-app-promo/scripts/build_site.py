"""Turn a page fragment plus its media into a static folder for any static host (e.g. Cloudflare Pages).

Usage:
  python3 build_site.py --page site/zh.html --assets OUTDIR/zh --out dist [--lang zh-CN]
  python3 build_site.py --page site/en.html --assets OUTDIR/en --out dist/en --lang en

The page is a fragment: leading <title>, <link> and <style> tags, then the body content. It is wrapped
in a full HTML document (doctype, charset, viewport, lang) and written to OUT/index.html; every file in
--assets is copied next to it, so the page's relative links (promo.mp4, case-1.jpg, ...) keep working.
Only writes inside --out. Uses the standard library only.
"""
import argparse
import os
import re
import shutil

HEAD_TAGS = re.compile(r'\s*(<title>.*?</title>|<link\b[^>]*>|<meta\b[^>]*>|<style>.*?</style>)', re.S)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--page', required=True)
    parser.add_argument('--assets', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--lang', default='zh-CN')
    args = parser.parse_args()

    fragment = open(args.page, encoding='utf8').read()
    head, pos = [], 0
    while (match := HEAD_TAGS.match(fragment, pos)):
        head.append(match.group(1))
        pos = match.end()
    if not any(tag.startswith('<title>') for tag in head):
        raise SystemExit('The page fragment must start with a <title>.')
    document = (
        '<!doctype html>\n'
        f'<html lang="{args.lang}">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + '\n'.join(head) + '\n</head>\n<body>\n' + fragment[pos:].strip() + '\n</body>\n</html>\n'
    )
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, 'index.html'), 'w', encoding='utf8') as f:
        f.write(document)
    copied = 0
    for name in sorted(os.listdir(args.assets)):
        source = os.path.join(args.assets, name)
        if os.path.isfile(source):
            shutil.copy2(source, os.path.join(args.out, name))
            copied += 1
    print(f'{args.out}/index.html written, {copied} asset(s) copied')


if __name__ == '__main__':
    main()
