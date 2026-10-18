#!/usr/bin/env python3
"""
Checks the app's library (public/data, built by `npm run data`) against independent,
trusted sources that were NOT used to build it, and reports how much matches.

    python3 scripts/verify/verify_data.py            # writes scripts/verify/report.json + report.md

References (downloaded into scripts/verify/.cache on first run):
  Quran Arabic   King Fahd Glorious Quran Printing Complex (KFGQPC) Hafs v18 data   thetruetruth/quran-data-kfgqpc
                 QuranEnc Uthmani text                                              npm: quran-json
  Tafsir         QUL / Tarteel (Quran.com's open library)                           spa5k/tafsir_api
                 alquran.cloud copy of al-Muyassar                                  npm: @muslimjs/ar.muyassar
  Hadith         Sunnah.com, with official numbers and gradings                     Jammooly1/hadiths-json-files
                 Sunnah.com, second independent scrape (text + narrator)            AhmedBaset/hadith-json
  Hisn al-Muslim azkar database (Hisn al-Muslim duas with references)               npm: azkar

Only the Python standard library is used.
"""
import json
import os
import re
import sys
import tarfile
import io
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'public', 'data')
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
RAW = 'https://raw.githubusercontent.com'

# ---------------------------------------------------------------- downloading

def fetch(url, retries=4):
    for i in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                raise RuntimeError(f'download failed: {url}: {e}')


def cached(name, url):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = fetch(url)
        with open(path, 'wb') as f:
            f.write(data)
    with open(path, 'rb') as f:
        return f.read()


def cached_json(name, url):
    return json.loads(cached(name, url))


def npm_file(pkg, inner):
    """Reads a file from the latest published npm tarball of `pkg`."""
    path = os.path.join(CACHE, 'npm', pkg.replace('/', '_'), inner.replace('/', '_'))
    if not os.path.exists(path):
        meta = json.loads(fetch(f'https://registry.npmjs.org/{pkg}/latest'))
        tar = tarfile.open(fileobj=io.BytesIO(fetch(meta['dist']['tarball'])))
        member = tar.extractfile('package/' + inner)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(member.read())
    with open(path, 'rb') as f:
        return json.loads(f.read())


def app(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)

# -------------------------------------------------------------- normalising

MARKS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]')


def letters(s):
    """Arabic letter skeleton: no vowels/marks, unified alef/ya/ta-marbuta/hamza seats."""
    s = unicodedata.normalize('NFC', s).replace('\uFDFA', ' صلى الله عليه وسلم ').replace('\uFDFB', ' جل جلاله ')
    s = MARKS.sub('', s)
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    s = re.sub('[^ء-ي ]', ' ', s)
    return ' '.join(s.split())


VOWELS = {'ً': 'an', 'ٌ': 'un', 'ٍ': 'in', 'َ': 'a', 'ُ': 'u', 'ِ': 'i', 'ّ': '~', 'ْ': 'o',
          'ۡ': 'o', 'ࣰ': 'an', 'ࣱ': 'un', 'ࣲ': 'in',
          # KFGQPC encodes the open tanween forms with these code points instead of U+08F0-08F2
          'ٗ': 'an', 'ٞ': 'un', 'ٖ': 'in'}

# Same encoding equivalence, for the strictest (every mark) comparison.
KFG_TANWEEN = str.maketrans({'ٗ': 'ࣰ', 'ٞ': 'ࣱ', 'ٖ': 'ࣲ'})


def full_marks(s):
    """Every letter and every Quranic mark, ignoring only tatweel, spaces, ayah numbers and Unicode composition."""
    s = unicodedata.normalize('NFC', s).translate(KFG_TANWEEN)
    s = re.sub('[ـ\\s٠-٩‌-‏]', '', s)
    # Marks on one letter may be stored in any order (e.g. shadda + tanween); compare them as a set.
    return re.sub('([ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]+)', lambda m: ''.join(sorted(m.group(1))), s)


def has_invisible(s):
    return bool(re.search('[‌-‏]', s))


def vowelled(s):
    """Letters plus the basic vowel signs (fatha, damma, kasra, sukun, shadda, tanween), encoding variants unified."""
    s = unicodedata.normalize('NFC', s)
    out = []
    for ch in s:
        if ch in VOWELS:
            out.append(VOWELS[ch])
        elif 'ء' <= ch <= 'ي' or ch in 'ٱ ':
            out.append(letters(ch) or ' ')
    t = ''.join(out)
    # A shadda+vowel may be stored in either order; sort each letter's marks.
    t = re.sub(r'((?:an|un|in|a|u|i|~|o)+)', lambda m: ''.join(sorted(re.findall('an|un|in|a|u|i|~|o', m.group(1)))), t)
    return ' '.join(t.split())


def english(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    return ' '.join(s.split())


def sim(a, b):
    """Word-level similarity 0..1 (1 = identical)."""
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a.split(), b.split(), autojunk=False).ratio()


def coverage(part, whole):
    """Share of `part`'s words that appear, in order, inside `whole` (1 = fully contained)."""
    p, w = part.split(), whole.split()
    if not p:
        return 1.0
    m = SequenceMatcher(None, p, w, autojunk=False)
    return sum(b.size for b in m.get_matching_blocks()) / len(p)


def word_recall(part, whole):
    """Share of `part`'s words found anywhere in `whole` (order ignored)."""
    p = part.split()
    if not p:
        return 1.0
    w = Counter(whole.split())
    hit = 0
    for x in p:
        if w[x] > 0:
            w[x] -= 1
            hit += 1
    return hit / len(p)


def pct(n, d):
    return round(100.0 * n / d, 2) if d else None

# ------------------------------------------------------------------- Quran


def check_quran():
    q = app('quran.json')
    ours = {(a[0], a[1]): a for a in q['ayat']}
    kfg = cached_json('kfgqpc_hafs_v18.json', f'{RAW}/thetruetruth/quran-data-kfgqpc/main/hafs/data/hafsData_v18.json')
    kfg_map = {(x['sora'], x['aya_no']): re.sub('[٠-٩]+\s*$', '', x['aya_text']).strip() for x in kfg}
    enc = npm_file('quran-json', 'dist/quran.json')
    enc_map = {(s['id'], v['id']): v['text'] for s in enc for v in s['verses']}

    res = {'total_ayat_app': len(ours), 'total_ayat_kfgqpc': len(kfg_map), 'total_ayat_quranenc': len(enc_map)}
    # Surah structure
    kfg_counts = Counter(k[0] for k in kfg_map)
    app_counts = {s['n']: s['count'] for s in q['surahs']}
    res['surah_count_match'] = sum(1 for s in range(1, 115) if app_counts.get(s) == kfg_counts.get(s))
    res['surahs'] = 114

    for name, ref in (('kfgqpc', kfg_map), ('quranenc', enc_map)):
        same_letters = same_vowels = same_full = spacing_only = invisible = 0
        diffs = []
        full_diffs = []
        for key, row in ours.items():
            r = ref.get(key)
            if r is None:
                diffs.append({'ayah': f'{key[0]}:{key[1]}', 'problem': 'missing in reference'})
                continue
            la, lr = letters(row[2]), letters(r)
            if la == lr:
                same_letters += 1
            elif la.replace(' ', '') == lr.replace(' ', ''):
                spacing_only += 1
                diffs.append({'ayah': f'{key[0]}:{key[1]}', 'problem': 'word split by a space', 'app': row[2], 'ref': r})
            else:
                diffs.append({'ayah': f'{key[0]}:{key[1]}', 'problem': 'letters differ', 'app': la, 'ref': lr, 'similarity': round(sim(la, lr), 4)})
            if vowelled(row[2]).replace(' ', '') == vowelled(r).replace(' ', ''):
                same_vowels += 1
            if has_invisible(row[2]):
                invisible += 1
            if full_marks(row[2]) == full_marks(r):
                same_full += 1
            else:
                full_diffs.append({'ayah': f'{key[0]}:{key[1]}', 'app': row[2], 'ref': r})
        res[name] = {
            'letters_and_spacing_identical': same_letters,
            'letters_and_spacing_identical_pct': pct(same_letters, len(ours)),
            'words_split_by_space': spacing_only,
            'letters_identical_ignoring_spaces_pct': pct(same_letters + spacing_only, len(ours)),
            'vowels_identical_ignoring_spaces': same_vowels,
            'vowels_identical_ignoring_spaces_pct': pct(same_vowels, len(ours)),
            'every_mark_identical_ignoring_spaces': same_full,
            'every_mark_identical_ignoring_spaces_pct': pct(same_full, len(ours)),
            'ayat_with_invisible_characters': invisible,
            'letter_differences': diffs,
            'mark_differences': full_diffs,
        }
    return res

# ---------------------------------------------------------------- Tafsir


def check_tafsir():
    q = app('quran.json')
    keys = [(a[0], a[1]) for a in q['ayat']]
    counts = Counter(k[0] for k in keys)
    out = {}

    def qul(slug):
        def one(s):
            return s, json.loads(cached(f'qul/{slug}/{s}.json', f'{RAW}/spa5k/tafsir_api/main/tafsir/{slug}/{s}.json'))
        with ThreadPoolExecutor(8) as ex:
            surahs = dict(ex.map(one, range(1, 115)))
        m = {}
        for s, arr in surahs.items():
            for i, entry in enumerate(arr):
                m[(s, i + 1)] = entry.get('text', '') if isinstance(entry, dict) else str(entry)
        return m

    def compare(app_texts, ref_map, label):
        ok = ok_words = 0
        bad = []
        for i, key in enumerate(keys):
            a = letters(app_texts[i])
            r = letters(ref_map.get(key, ''))
            # Some sources group several ayat in one entry: also accept the neighbouring entries.
            neigh = ' '.join(letters(ref_map.get((key[0], key[1] + d), '')) for d in (-2, -1, 0, 1, 2))
            c = max(coverage(a, r), coverage(a, neigh)) if a else (1.0 if not r else 0.0)
            if (word_recall(a, neigh) if a else 1.0) >= 0.9:
                ok_words += 1
            if c >= 0.9:
                ok += 1
            else:
                bad.append({'ayah': f'{key[0]}:{key[1]}', 'coverage': round(c, 3), 'app': app_texts[i][:160], 'ref': ref_map.get(key, '')[:160]})
        return {'reference': label, 'checked': len(keys), 'matching': ok, 'matching_pct': pct(ok, len(keys)),
                'same_words_any_order_pct': pct(ok_words, len(keys)), 'mismatches': bad}

    muy = app('tafsir-muyassar.json')['text']
    jal = app('tafsir-jalalayn.json')['text']
    out['muyassar_vs_qul'] = compare(muy, qul('ar-tafsir-muyassar'), 'QUL (Tarteel/Quran.com) ar-tafsir-muyassar')
    ac = npm_file('@muslimjs/ar.muyassar', 'Data/ar.muyassar.json')
    ac_map = {(s['number'], i + 1): a['text'] for s in ac['surahs'] for i, a in enumerate(s['ayahs'])}
    out['muyassar_vs_alquran_cloud'] = compare(muy, ac_map, 'alquran.cloud ar.muyassar')
    out['jalalayn_vs_qul'] = compare(jal, qul('ar-tafsir-al-jalalayn'), 'QUL (Tarteel/Quran.com) ar-tafsir-al-jalalayn')
    return out

# ----------------------------------------------------------------- Hadith

REF_FILES = {
    'bukhari': 'sahih_bukhari', 'muslim': 'sahih_muslim', 'abudawud': 'sunan_abi_dawud',
    'tirmidhi': 'jami_at_tirmidhi', 'nasai': 'sunan_an_nasai', 'ibnmajah': 'sunan_ibn_majah',
}


def grade_level(g):
    g = g.lower()
    if re.search(r'mawdu|fabricat|maudu|batil|munkar', g):
        return 'mawdu'
    if re.search(r'da.?if|weak|daeef|shadh', g):
        return 'daif'
    if 'hasan' in g or 'sahih' in g or 'authentic' in g:
        return 'acceptable'
    return 'unknown'


def ref_number(title):
    """'Sahih Muslim 3033 b' -> '3033b'; 'Jami` at-Tirmidhi 2146, 2298' -> '2146'; 'Bukhari 5709-5712' -> '5709'."""
    m = re.search(r'\s(\d+)\s*([a-z]?)\b(?:\s*[-,].*)?$', title.strip())
    return (m.group(1) + m.group(2)) if m else None


def app_number_variants(col, h, arabicnum):
    """Numbers under which this app hadith might be cited."""
    return {str(h[0]).split('.')[0]}


def shingles(words, k=5):
    return {' '.join(words[i:i + k]) for i in range(max(1, len(words) - k + 1))}


def check_hadith():
    out = {}
    narrator_ok = narrator_total = 0
    for col, fname in REF_FILES.items():
        ref = cached_json(f'sunnah/{fname}.json', f'{RAW}/Jammooly1/hadiths-json-files/HEAD/{fname}.json')
        refs = [h for b in ref['all_books'] for h in b['hadith_list']]
        mine = app(f'hadith/{col}.json')['hadiths']  # [n, book, en, ar, narrator, grades]
        by_num = defaultdict(list)
        for h in mine:
            by_num[str(h[0]).lower()].append(h)

        # Index app hadith by Arabic 5-word shingles, to find a text when the number does not match.
        index = defaultdict(set)
        app_letters = [letters(h[3]) for h in mine]
        for i, t in enumerate(app_letters):
            for sh in shingles(t.split()):
                index[sh].add(i)

        stats = Counter()
        examples = defaultdict(list)
        grade_pairs = Counter()
        nums = [ref_number(r['title']) for r in refs]
        for idx, r in enumerate(refs):
            im = re.search(r'introduction\s+(\d+)', r['title'], re.I)
            if im:
                # Muslim's introduction has its own numbering ("i8" in the app).
                ra = letters(r.get('arabic_text', ''))
                ok = any(max(sim(letters(h[3]), ra), coverage(ra, letters(h[3]))) >= 0.85 for h in by_num.get('i' + im.group(1), []))
                stats['introduction_checked'] += 1
                stats['introduction_text_present'] += int(ok)
                continue
            num = ref_number(r['title'])
            if not num:
                stats['ref_without_number'] += 1
                continue
            base = re.match(r'\d+', num).group(0)
            ra = letters(r.get('arabic_text', ''))
            re_ = english((r.get('narrator') or '') + ' ' + (r.get('english_text') or ''))
            stats['checked'] += 1
            cands = by_num.get(num) or by_num.get(base, [])
            def score(h):
                a = letters(h[3])
                return max(sim(a, ra), coverage(ra, a))
            best = max(cands, key=score, default=None)
            s_ar = score(best) if best else 0
            if best and s_ar >= 0.85:
                stats['number_and_arabic_match'] += 1
                s_en = max(sim(english(best[2]), re_), coverage(re_, english(best[2])))
                if s_en >= 0.8:
                    stats['english_match'] += 1
                elif len(examples['english_differs']) < 5:
                    examples['english_differs'].append({'ref': r['title'], 'similarity': round(s_en, 3)})
                # Narrator shown by the app vs the narrator line on Sunnah.com
                rn = english(r.get('narrator') or '')
                if best[4] and rn:
                    narrator_total += 1
                    an = english(best[4])
                    if an in rn or SequenceMatcher(None, an, rn.replace('narrated', '').strip()).ratio() >= 0.8 or coverage(an, rn) >= 0.8:
                        narrator_ok += 1
                    elif len(examples['narrator_differs']) < 8:
                        examples['narrator_differs'].append({'ref': r['title'], 'app': best[4], 'sunnah.com': r.get('narrator')})
                # Grading
                rg = (r.get('grade') or '').strip()
                if rg:
                    stats['ref_graded'] += 1
                    rlevel = grade_level(rg)
                    if any(grade_level(g[1]) == rlevel and ('Sunnah.com' in g[0] or ('Albani' in rg and 'Albani' in g[0]) or ('Darussalam' in rg and 'Zubair' in g[0])) for g in best[5]):
                        stats['sunnah_grade_shown'] += 1
                    who = 'Al-Albani' if 'Albani' in rg else 'Zubair Ali Zai' if 'Darussalam' in rg else None
                    app_g = [g for g in best[5] if who and who.lower() in g[0].lower()]
                    if not app_g:
                        stats['grade_missing_in_app'] += 1
                    else:
                        a, b = grade_level(app_g[0][1]), grade_level(rg)
                        grade_pairs[(a, b)] += 1
                        if a == b:
                            stats['grade_match'] += 1
                        elif len(examples['grade_differs']) < 8:
                            examples['grade_differs'].append({'ref': r['title'], 'app': app_g[0], 'sunnah.com': rg})
            else:
                # Is the text somewhere else in the app (i.e. under a different number)?
                votes = Counter()
                for sh in shingles(ra.split()):
                    for i in index.get(sh, ()):
                        votes[i] += 1
                found = None
                for i, _ in votes.most_common(3):
                    if max(sim(app_letters[i], ra), coverage(ra, app_letters[i])) >= 0.85:
                        found = mine[i]
                        break
                if found:
                    # Reference typo? e.g. Sunnah.com lists "2534, 2735, 2536" and the app has this text as 2535.
                    prev = next((n for n in reversed(nums[:idx]) if n), None)
                    nxt = next((n for n in nums[idx + 1:] if n), None)
                    an = re.match(r'\d+', str(found[0]))
                    pn = re.match(r'\d+', prev or '')
                    nn = re.match(r'\d+', nxt or '')
                    if an and pn and nn and int(pn.group(0)) <= int(an.group(0)) <= int(nn.group(0)) and an.group(0) != base:
                        stats['reference_typo_app_correct'] += 1
                        stats['number_and_arabic_match'] += 1
                        if len(examples['reference_typo']) < 8:
                            examples['reference_typo'].append({'sunnah.com': r['title'], 'neighbours': [prev, nxt], 'app_number': found[0]})
                        continue
                    stats['text_present_but_different_number'] += 1
                    if len(examples['different_number']) < 8:
                        examples['different_number'].append({'sunnah.com': r['title'], 'app_number': found[0]})
                else:
                    stats['text_not_found_in_app'] += 1
                    if len(examples['not_found']) < 5:
                        examples['not_found'].append({'sunnah.com': r['title'], 'arabic': r.get('arabic_text', '')[:120]})
        c = stats['checked']
        if stats['introduction_checked']:
            stats['introduction_text_present_pct'] = pct(stats['introduction_text_present'], stats['introduction_checked'])
        out[col] = {
            'reference': f'Sunnah.com ({fname}, Jammooly1/hadiths-json-files)',
            'checked': c,
            'number_and_arabic_match_pct': pct(stats['number_and_arabic_match'], c),
            'text_present_but_different_number_pct': pct(stats['text_present_but_different_number'], c),
            'text_not_found_pct': pct(stats['text_not_found_in_app'], c),
            'english_match_pct_of_matched': pct(stats['english_match'], stats['number_and_arabic_match']),
            'grade_match_pct': pct(stats['grade_match'], stats['ref_graded'] - stats['grade_missing_in_app']) if stats['ref_graded'] else None,
            'grade_missing_in_app': stats['grade_missing_in_app'],
            'sunnah_com_grade_shown_pct': pct(stats['sunnah_grade_shown'], stats['ref_graded']) if stats['ref_graded'] else None,
            'grade_confusion(app,sunnah)': {f'{a}->{b}': n for (a, b), n in grade_pairs.most_common()},
            'counts': dict(stats),
            'examples': examples,
        }
        print(f'  {col}: {out[col]["number_and_arabic_match_pct"]}% number+text match', file=sys.stderr)
    out['narrator'] = {'checked': narrator_total, 'match': narrator_ok, 'match_pct': pct(narrator_ok, narrator_total)}
    return out

# ----------------------------------------------------------- Hisn al-Muslim


HISN_INSTR = re.compile(r'\([^)]*\)|\[[^\]]*\]|\*')
HISN_LEAD = re.compile(r'^(?:و?قال رسول الله صلى الله عليه وسلم|و?قال صلى الله عليه وسلم|و?كان رسول الله صلى الله عليه وسلم)\s*:?')


def check_hisn():
    """Each dua is checked two ways: against a second copy of the book (same chapter), and against the
    original texts it comes from (the Quran and the hadith collections, both verified above)."""
    hisn = app('hisn.json')['chapters']
    az = npm_file('azkar', 'azkars.json')
    items = [(cat, z) for cat, zs in az.items() for z in zs]
    AZ = [letters(re.sub(r'[()\[\]{}﴿﴾*]', ' ', z['zekr'])) for _, z in items]
    cats = [letters(cat) for cat, _ in items]

    corpus = [letters(a[2]) for a in app('quran.json')['ayat']]
    names = [f'Quran {a[0]}:{a[1]}' for a in app('quran.json')['ayat']]
    for col in ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'nawawi', 'qudsi']:
        for h in app(f'hadith/{col}.json')['hadiths']:
            corpus.append(letters(h[3]))
            names.append(f'{col} {h[0]}')
    index = defaultdict(set)
    for i, t in enumerate(corpus):
        w = t.split()
        for k in range(len(w) - 2):
            index[' '.join(w[k:k + 3])].add(i)

    def primary(t):
        w = t.split()
        votes = Counter(i for k in range(len(w) - 2) for i in index.get(' '.join(w[k:k + 3]), ()))
        best = (None, 0.0)
        for i, _ in votes.most_common(5):
            c = coverage(t, corpus[i])
            if c > best[1]:
                best = (names[i], c)
        return best

    rows = []
    for c in hisn:
        if c['id'] == 0:
            continue
        for i, t in enumerate(c['text']):
            a = letters(HISN_LEAD.sub('', HISN_INSTR.sub(' ', t).strip()))
            if len(a.split()) < 2:
                continue
            same = [k for k in range(len(AZ)) if cats[k] == letters(c['ar']) or sim(cats[k], letters(c['ar'])) > 0.6]
            k = max(same or range(len(AZ)), key=lambda k: coverage(a, AZ[k]))
            if coverage(a, AZ[k]) < 0.85:
                k2 = max(range(len(AZ)), key=lambda k: coverage(a, AZ[k]))
                k = k2 if coverage(a, AZ[k2]) > coverage(a, AZ[k]) else k
            src, p = primary(a) if len(a.split()) >= 3 else (None, 0.0)
            rows.append({'chapter': c['ar'], 'item': i + 1, 'app': t, 'second_copy': round(coverage(a, AZ[k]), 3),
                         'original_source': src, 'original_coverage': round(p, 3)})
    n = len(rows)
    copy_ok = sum(1 for r in rows if r['second_copy'] >= 0.85)
    orig_ok = sum(1 for r in rows if r['original_coverage'] >= 0.9)
    either = sum(1 for r in rows if r['second_copy'] >= 0.85 or r['original_coverage'] >= 0.9)
    return {
        'reference': 'second copy: azkar database of Hisn al-Muslim (npm: azkar); originals: Quran (KFGQPC) + hadith collections',
        'duas_checked': n,
        'matches_second_copy_pct': pct(copy_ok, n),
        'found_word_for_word_in_quran_or_hadith_pct': pct(orig_ok, n),
        'confirmed_by_at_least_one_pct': pct(either, n),
        'unconfirmed': [r for r in rows if r['second_copy'] < 0.85 and r['original_coverage'] < 0.9],
    }


# ------------------------------------------------------------------ main


def main():
    if not os.path.exists(os.path.join(DATA, 'quran.json')):
        sys.exit('public/data is missing: run `npm run data` first.')
    report = {}
    for name, fn in (('quran', check_quran), ('tafsir', check_tafsir), ('hadith', check_hadith), ('hisn', check_hisn)):
        print(f'Checking {name}…', file=sys.stderr)
        report[name] = fn()
    with open(os.path.join(HERE, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary(report), ensure_ascii=False, indent=1))


def summary(r):
    q = r['quran']
    s = {
        'Quran: letters & word spacing = KFGQPC %': q['kfgqpc']['letters_and_spacing_identical_pct'],
        'Quran: every mark = KFGQPC %': q['kfgqpc']['every_mark_identical_ignoring_spaces_pct'],
        'Quran: letters & word spacing = QuranEnc %': q['quranenc']['letters_and_spacing_identical_pct'],
        'Quran: every mark = QuranEnc %': q['quranenc']['every_mark_identical_ignoring_spaces_pct'],
        'Quran: ayat with invisible characters': q['kfgqpc']['ayat_with_invisible_characters'],
        'Surah ayah counts correct': f"{q['surah_count_match']}/114",
    }
    for k, v in r['tafsir'].items():
        s[f'Tafsir {k} %'] = v['matching_pct']
    for col, v in r['hadith'].items():
        if col == 'narrator':
            s['Hadith narrator correct %'] = v['match_pct']
            continue
        s[f'Hadith {col}: number+text %'] = v['number_and_arabic_match_pct']
        s[f'Hadith {col}: text under other number %'] = v['text_present_but_different_number_pct']
        s[f'Hadith {col}: source grade agrees with Sunnah.com %'] = v['grade_match_pct']
        s[f'Hadith {col}: Sunnah.com grade shown in app %'] = v['sunnah_com_grade_shown_pct']
    s['Hisn: matches second copy %'] = r['hisn']['matches_second_copy_pct']
    s['Hisn: word-for-word in Quran/hadith %'] = r['hisn']['found_word_for_word_in_quran_or_hadith_pct']
    s['Hisn: confirmed by at least one %'] = r['hisn']['confirmed_by_at_least_one_pct']
    return s


if __name__ == '__main__':
    main()
