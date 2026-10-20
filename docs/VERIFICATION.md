# Verification report: does the app's library match trusted sources?

**Last run:** 2026-10-20 · **How to repeat it:** `npm run data && npm run verify`

The app's Quran, hadith, tafsir and Hisn al-Muslim data were compared against **independent references**:
sources that were not used to build the app, wherever that was possible. Nothing was checked from memory.
Every number below comes from `scripts/verify/verify_data.py` (data) and `scripts/verify/eval_search.mts`
(search), which you can run yourself.

## Summary

| What was checked | Compared with | Before fixes | **Now** |
|---|---|---|---|
| Quran Arabic: letters and vowel marks (6,236 ayat) | King Fahd Complex (KFGQPC) official Hafs text; QuranEnc | 100% of the letters and vowel marks were right | **100%** (KFGQPC), **99.97%** QuranEnc¹ |
| Quran Arabic: displayed correctly (no broken words) | same | **72.2%**: 1,734 ayat had a word split by a stray space (e.g. "هُدً ى") and 820 had invisible characters | **100%**, 0 invisible characters |
| Surah structure (ayat per surah) | KFGQPC | 114/114 | **114/114** |
| Tafsir al-Muyassar | alquran.cloud copy; QUL (Quran.com's open library) | 100% / 98.2% | **100% / 98.2%**² |
| Tafsir al-Jalalayn | QUL | 72.8% | **72.8%**: different printed editions, see "Not yet verified" |
| Hadith: correct number and correct text (33,991 hadith, 6 books) | Sunnah.com data | Sahih Muslim **0%** (wrong numbering), Tirmidhi 96.6%, others 99.7–99.95% | **99.89% overall** (table below) |
| Hadith: English translation matches | Sunnah.com | 99.9–100% | **99.9–100%** |
| Hadith: narrator shown | Sunnah.com narrator line | 98.3% | **99.89%** |
| Hadith gradings: Sunnah.com's grading shown in the app | Sunnah.com (Al-Albani / Darussalam) | not shown | **≈100%** (shown next to the other gradings) |
| Hisn al-Muslim duas (290) | a second copy of the book, and the original Quran/hadith text | 2 corrupted duas | **95.2%** confirmed by at least one source; 2 duas corrected |

¹ The remaining differences (2:72, 11:41) are the same mark stored with different Unicode characters.
² QUL's edition adds an introduction to each surah, so the first ayah of a surah differs.

### Hadith, book by book (number **and** text match Sunnah.com)

| Book | Checked | Match | Notes |
|---|---|---|---|
| Sahih al-Bukhari | 7,277 | **100%** | |
| Sahih Muslim | 7,358 + 83 introduction | **99.74%**, introduction 100% | was 0%: the source's own sequence numbers were shown instead of the standard numbers |
| Sunan Abi Dawud | 5,276 | **100%** | |
| Jami' at-Tirmidhi | 4,052 | **99.61%** | 73 hadith were missing (empty in the source) and are now filled from Sunnah.com |
| Sunan an-Nasa'i | 5,683 | **100%** | |
| Sunan Ibn Majah | 4,345 | **99.91%** | |

Where the numbers disagreed, the list was checked against its neighbours. In 9 cases the **Sunnah.com copy
has a typo**: for example, an entry labelled "2735" sits between 2534 and 2536, so it is really 2535. The
app's number is right in those cases and they are counted as matches.

### Gradings: scholars and editions sometimes differ

The app's main hadith source and Sunnah.com sometimes grade the same hadith differently: for example, one
source says Zubair Ali Za'i graded it *Da'if*, while Sunnah.com shows *Hasan (Darussalam)*.

| Book | Source and Sunnah.com agree |
|---|---|
| Abu Dawud (Al-Albani) | 99.4% |
| Nasa'i | 97.0% |
| Tirmidhi | 94.8% |
| Ibn Majah | 94.0% |

Without a third source we cannot decide which one is right, so **the app now shows both gradings**. When
they disagree, the hadith is labelled **"Scholars differ"** instead of picking one.

## Search and "Verify" accuracy (no AI)

Test questions were built from the **independent references**, not from the app's own data. Fixed random
seed, so every run uses the same questions.

| Test | Questions | Right answer is #1 | In top 5 |
|---|---|---|---|
| Quran: 5 Arabic words of an ayah (KFGQPC) | 300 | **92.7%** | **99.3%** |
| Hadith: 8 English words (Sunnah.com) | 300 | **93.0%** | **98.7%** |
| Hadith: 6 Arabic words of the matn (Sunnah.com) | 300 | 73.3% | **92.0%** |
| Hisn al-Muslim: 5 Arabic words (second copy) | 143 | 82.5% | **92.3%** |

Arabic hadith wording often repeats across chains of narration, so the #1 result is often a "sister" hadith
with the same wording.

| "Verify" screen | Cases | Correct |
|---|---|---|
| Real Quran and Bukhari/Muslim quotes → should say **Found** | 80 | **98.8%** |
| Made-up claims ("recite Surah X 70 times on Tuesday and you'll never be poor") → must **not** say Found | 50 | **100%**: none was confirmed |
| Real dua + invented reward → should say **Partly matches** | 40 | 72.5% (the others said "No source found", which is cautious but less precise; none said Found) |

## "Ask" and "Verify": questions about a subject

Questions like *"Which ayah talks about the dog?"* or *«هل ذكر الكلب في القرآن؟»* must bring back **every** ayah
that mentions the subject, so the AI can answer from them. The right answers come from the data: all ayat whose
English translation contains the word. 33 subjects (dog, spider, ant, bee, elephant, hoopoe, fig, olive, whale, cave …),
each asked 5 ways (3 English, 2 Arabic), 165 questions.

| Test | Every ayah found | Ayat found |
|---|---|---|
| With AI keywords (Gemini, Groq, Claude, Ollama …) | **100%** (before this fix: 58.2%) | **100%** (before: 65.5%) |
| Without AI (the app alone) | 84.2% (before: 38.2%) | 91.1% (before: 39.4%) |

Without AI the misses are other Arabic word forms (e.g. «حمير» for «حمار») or an ayah that refers to the
subject only by a pronoun (27:22 for the hoopoe). The AI keywords cover those.

What was fixed: question words ("which ayah mentions…", «القرآن») no longer drown the subject; plurals and the
Arabic article are handled ("dogs" → dog, «الكلب» → كلب); the AI's keywords count double; up to 8 ayat are
given to the AI when the question is about the Quran (before: 3); and Verify no longer cuts the list to 6.

## Fixes made because of this report

1. **Quran text** is now taken directly from the King Fahd Complex official Hafs data. The only change is the
   tanween encoding: three code points meant for KFGQPC's own font are swapped for the standard Unicode ones,
   one-to-one, which was verified by counting. This removed the broken words and invisible characters.
2. **Sahih Muslim** uses the standard numbering cited everywhere (e.g. *2699a*, *3033b*). Entries that
   Sunnah.com files under several numbers keep that label (e.g. *546b-d*). The book's introduction is
   numbered as Sunnah.com numbers it (*Introduction 8*). 11 entries without any standard number say so
   instead of showing an invented number.
3. Sub-numbers in all books use Sunnah.com's style (*402b*, not *402.2*).
4. **Missing hadith** (empty in the main source: 73 in Tirmidhi, a few in other books) are filled from
   Sunnah.com, only when the text is not already present under another number.
5. **Gradings from Sunnah.com** are shown next to the existing ones.
6. **Hisn al-Muslim**: 2 corrections, each backed by a second copy of the book and the original source or
   Arabic grammar:
   - Opening-prayer dua: "وبحمد ك … ولا أ له غيرك" → "وبحمدك … ولا إله غيرك" (matches Tirmidhi 242 word for word).
   - Mosque dua: "على نوراً" → "على نورٍ".
7. Invisible direction characters were removed from every text.

## Not yet verified (and why)

- **English Quran translation (Rowwad):** no independent copy was reachable from the build environment.
  QuranEnc.com is the official source; a spot check there is recommended.
- **Tafsir al-Jalalayn:** only 72.8% matches QUL's edition. The two editions really differ in wording (for
  example, at 2:48 one has "فيه" where the other has "وهو يوم القيامة"). A third copy is needed to tell which
  edition the app should use.
- **Hisn al-Muslim, 14 items** could not be confirmed automatically. Most are the author's own descriptions
  ("يقوم يصلي إن أراد ذلك") or Quran quotes in ordinary spelling. One, in the bowing dua, has a wording
  difference between copies ("ودمي ولحمي" vs "ومخي") and needs review by a scholar. The full list is in
  `scripts/verify/report.json` (`hisn.unconfirmed`).
- **English chapter titles of Hisn al-Muslim** were translated by AI and have not been reviewed by a person.
- **The AI layer** (Ollama chat and AI verdicts) was not measured, because no model can run in the build
  environment. Its citation checking is covered by code: an answer can only cite sources the search returned.
  Re-run this evaluation with your model to measure it.
- **The hadith gradings themselves.** We can show that the app reproduces what Sunnah.com and the source
  report, and flag disagreements, but judging a grading is the work of hadith scholars.

## References used

| Reference | Used for |
|---|---|
| [KFGQPC Hafs data](https://github.com/thetruetruth/quran-data-kfgqpc) (King Fahd Glorious Quran Printing Complex) | Quran text (now also the app's source) |
| [quran-json](https://www.npmjs.com/package/quran-json) (QuranEnc text) | independent Quran check |
| [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) (QUL / Tarteel) | tafsir |
| [@muslimjs/ar.muyassar](https://www.npmjs.com/package/@muslimjs/ar.muyassar) (alquran.cloud) | Tafsir al-Muyassar |
| [Jammooly1/hadiths-json-files](https://github.com/Jammooly1/hadiths-json-files) (Sunnah.com) | hadith numbers, text, narrators, gradings |
| [AhmedBaset/hadith-json](https://github.com/AhmedBaset/hadith-json) (Sunnah.com) | second hadith copy, used during the investigation |
| [azkar](https://www.npmjs.com/package/azkar) (Hisn al-Muslim database) | second copy of Hisn al-Muslim |
