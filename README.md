# Muslim — one app for Quran, Hadith and Dua, with sources you can trust

## The problem

When a sheikh says "recite this for rizq" or "say this dua for healing", checking it
means searching many websites, getting different answers, and often no clear
source. This app puts everything in one place: an AI assistant, search across the
Quran, Hadith, Duas and Tafsir, and a proper citation for every answer.

## Core principle: the AI never makes up a source

AI chatbots can invent hadith, mix up narrators, or quote ayat wrongly. That is
not acceptable here, so the rules are:

1. **Answers come from a verified library, not from the AI's memory.** The AI
   searches the app's own database of Quran text, hadith collections, dua books
   and tafsir, then writes an answer using only what it found.
2. **Every claim links to a real record**: surah and ayah number, or hadith
   collection, book and number, plus the narrator (e.g. "narrated by Abu
   Hurairah, Sahih al-Bukhari 6405").
3. **Hadith grading is always shown** (Sahih / Hasan / Da'if / Mawdu'), along
   with who graded it.
4. **If nothing is found, the app says so.** It shows "no authentic source found"
   and never guesses.
5. **It is not a mufti.** For fiqh rulings and personal fatwas, it points the
   user to qualified scholars.

## Features

### MVP (version 1)
- **Search** across the Quran (Arabic, translation and transliteration), Hadith,
  Duas and Adhkar. Search works by keyword or by topic, e.g. *rizq*, *health*,
  *anxiety*, *travel*, *exams*, *debt*, *protection*.
- **Topic collections**: curated pages such as "Duas for rizq", each entry with
  its source and grading.
- **AI chat**: ask a question in plain English or Arabic and get an answer with
  citations. Tap a citation to open the full text.
- **Favorites**: save ayat, hadith and duas into personal folders.

### Version 2: "Is this real?" (verify a claim)
- Record audio or paste a link to a clip, or type what the sheikh said.
- The app transcribes the audio, pulls out the claim ("say X 100 times for Y"),
  and searches the library.
- It returns one of these results:
  - ✅ **Found, authentic**: shows the source and grading, with a button to add
    it to favorites.
  - ⚠️ **Found, but weak or fabricated**: shows the grading and who graded it.
  - ❓ **Not found**: no source found in the library; ask a scholar.
  - 🔀 **Partly correct**: the dua is real, but the added reward or number of
    repetitions isn't in the source.

### Later ideas
- Tafsir side by side (Ibn Kathir, al-Sa'di, al-Tabari, and others)
- Audio recitation for each ayah and dua
- Daily adhkar reminders (morning and evening) and a Hisn al-Muslim reader
- Prayer times and qibla
- Offline mode for the core library
- Community "claims checked" feed, with the most-asked claims and their verdicts

## Data sources (licensing to be confirmed before shipping)

| Content | Candidate sources |
|---|---|
| Quran text | Tanzil.net (Uthmani/Simple text) |
| Translations, tafsir, audio | Quran.com API (Quran Foundation) |
| Hadith with grading | Sunnah.com API, open hadith datasets (Bukhari, Muslim, the Sunan, etc.) |
| Duas & adhkar | Hisn al-Muslim (Fortress of the Muslim) |

## Proposed architecture

```
Mobile app (React Native / Expo)
        │
        ▼
Backend API ── Postgres + pgvector (Quran, hadith, duas, tafsir + embeddings)
        │
        ├── Search: keyword + semantic (vector) search, topic tags
        ├── AI chat: Claude API with a "search_library" tool;
        │            the model may only cite records returned by the tool,
        │            and each citation is checked against the DB before display
        └── Verify: speech-to-text → claim extraction → library search → verdict
```

## Roadmap
1. Load the Quran, the major hadith collections and Hisn al-Muslim into the
   database, with topic tags
2. Search screen, detail screens and favorites
3. AI chat with checked citations
4. The "Is this real?" verification flow
5. Reminders, audio, offline mode
