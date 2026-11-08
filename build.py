#!/usr/bin/env python3
"""Парсер Swfuse/devops-interview -> data.js для статического сайта.
Запуск: python3 -I build.py <путь к interview.md> [<per-company dir>]
"""
import sys, os, re, json, html

def clean_answer(lines):
    # убрать пустые по краям
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        return ""
    # снять обёртку "- Ответ" (разные варианты)
    if re.match(r'^\s*[-*]\s*Ответ\s*$', lines[0], re.IGNORECASE):
        lines = lines[1:]
    # ещё раз убрать ведущие пустые
    while lines and not lines[0].strip():
        lines.pop(0)
    # если большинство непустых строк с отступом >=4 пробелов — деиндент на 4
    nonblank = [l for l in lines if l.strip()]
    if nonblank:
        indented = sum(1 for l in nonblank if l.startswith('    ') or l.startswith('\t'))
        if indented >= max(1, int(len(nonblank) * 0.7)):
            out = []
            for l in lines:
                if l.startswith('    '):
                    out.append(l[4:])
                elif l.startswith('\t'):
                    out.append(l[1:])
                else:
                    out.append(l)
            lines = out
    # убрать ведущие/замыкающие горизонтальные линии и пустые
    while lines and (not lines[0].strip() or re.match(r'^\s*-{3,}\s*$', lines[0])):
        lines.pop(0)
    while lines and (not lines[-1].strip() or re.match(r'^\s*-{3,}\s*$', lines[-1])):
        lines.pop()
    text = "\n".join(lines)
    # нормализовать картинки -> локальная папка imgs/
    def img_sub(m):
        alt, url = m.group(1), m.group(2).strip()
        base = None
        if 'imgs/' in url:
            base = url.split('imgs/')[-1]
            base = base.split(')')[0]
        if base:
            return '![%s](imgs/%s)' % (alt, base)
        return m.group(0)
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', img_sub, text)
    return text.strip()

def slugify(s, n):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'[^a-zA-Zа-яА-Я0-9]+', '-', s).strip('-').lower()
    return (s[:48] or 'q') + '-' + str(n)

def parse_md(path):
    with open(path, encoding='utf-8') as f:
        raw = f.read().replace('\r', '')
    lines = raw.split('\n')
    # пропустить TOC: начать с первого реального '# '
    start = 0
    for i, l in enumerate(lines):
        if re.match(r'^# \S', l):
            start = i
            break
    lines = lines[start:]

    h1 = None
    h2 = None
    questions = []
    cur = None
    buf = []
    def flush():
        nonlocal cur, buf
        if cur is not None:
            cur['a'] = clean_answer(buf)
            questions.append(cur)
        cur = None
        buf = []
    for l in lines:
        if re.match(r'^# \S', l):
            flush(); h1 = l[2:].strip(); h2 = None
        elif re.match(r'^## \S', l):
            flush(); h2 = l[3:].strip()
        elif re.match(r'^### \S', l):
            flush()
            cur = {'h1': h1 or 'Вопросы', 'h2': h2 or 'Общее', 'q': l[4:].strip(), 'a': ''}
        else:
            if cur is not None:
                buf.append(l)
    flush()
    return questions

def build_tree(questions):
    n = 0
    sections = []
    s_idx = {}
    for q in questions:
        n += 1
        q['id'] = slugify(q['q'], n)
        h1 = q['h1']; h2 = q['h2']
        if h1 not in s_idx:
            s_idx[h1] = {'h1': h1, 'cats': {}, 'order': []}
            sections.append(s_idx[h1])
        sec = s_idx[h1]
        if h2 not in sec['cats']:
            sec['cats'][h2] = {'h2': h2, 'questions': []}
            sec['order'].append(h2)
        sec['cats'][h2]['questions'].append({'id': q['id'], 'q': q['q'], 'a': q['a']})
    out = []
    for sec in sections:
        cats = [sec['cats'][h2] for h2 in sec['order']]
        out.append({'h1': sec['h1'], 'categories': cats})
    return out, n

def main():
    if len(sys.argv) < 2:
        print('usage: build.py interview.md [per-company-dir]'); sys.exit(1)
    src = sys.argv[1]
    questions = parse_md(src)
    tree, total = build_tree(questions)

    data = {
        'source': 'Swfuse/devops-interview',
        'total': total,
        'sections': tree,
    }
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, 'data.js')
    js = 'window.DEVOPS_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js)

    # краткая статистика (без дампа контента)
    print('Всего вопросов:', total)
    print('Разделов (#):', len(tree))
    for sec in tree:
        cats = sec['categories']
        print('  #', sec['h1'][:40], '->', len(cats), 'категорий,',
              sum(len(c['questions']) for c in cats), 'вопросов')
    size = os.path.getsize(out_path)
    print('data.js:', round(size/1024), 'КБ')
    # один короткий пример (обрезанный), чтобы убедиться, что чистка работает
    sample = questions[1] if len(questions) > 1 else questions[0]
    print('--- пример ---')
    print('Q:', sample['q'][:70])
    print('A(0..200):', sample['a'][:200].replace('\n', ' '))

if __name__ == '__main__':
    main()
