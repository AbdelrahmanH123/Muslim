# Muslim — Quran, Hadith & Duas in one place, with sources you can trust

An Android app and website (English + Arabic) where you can search the Quran,
the major hadith collections and Hisn al-Muslim, ask an AI assistant, and check
things you heard in a lecture or video. Every answer shows its real source.
**It is completely free to run.**

## Core principle: the AI never makes up a source

1. **Answers come from the app's own library, not from the AI's memory.** The AI
   gets numbered sources from the library and must cite them like `[1]`.
2. **Citations are checked.** Any citation number that doesn't match a real
   library record is removed, and answers without citations are flagged.
3. **Hadith gradings are always shown** (Sahih / Hasan / Da'if / Mawdu'), with
   the scholar who graded each one.
4. **If nothing is found, the app says so** instead of guessing.
5. **It is not a mufti.** Personal rulings are referred to qualified scholars.

## What works today

| Screen | What it does |
|---|---|
| 🔍 **Search** | Searches the Quran, Hisn al-Muslim and 9 hadith collections in English or Arabic, ignoring diacritics. You can also type a reference like `2:255` or `Bukhari 6405`. |
| 📚 **Topics** | Rizq, debt, anxiety, health, protection, forgiveness, exams, family, travel, sleep and more. Each topic links to the relevant Hisn al-Muslim chapters and ayat. |
| 💬 **Ask** | AI chat that answers only from library sources, with checked citations. Without AI it still shows the matching sources. |
| ✅ **Verify** | Paste or speak what a sheikh said. The result is **Found / Weak or fabricated / Partly matches / No source found**, with the closest matches. The microphone works in Chrome and Edge on the website. |
| ⭐ **Favorites** | Save any ayah, hadith or dua into folders, e.g. "Duas for rizq". |
| 📖 **Readers** | Full surah reader with Tafsir al-Muyassar and al-Jalalayn, a hadith page with book, narrator and every grading, and Hisn al-Muslim chapters with their references. |
| ⚙︎ **Settings** | English / العربية (right-to-left), and the free AI setup. |

## The library (all free, openly published)

| Content | Source |
|---|---|
| Quran (Uthmani, Hafs) | Tanzil Project, via [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api) |
| English translation | Rowwad Translation Center ([quranenc.com](https://quranenc.com/en/browse/english_rwwad)) |
| Tafsir | Tafsir al-Muyassar (King Fahd Complex), Tafsir al-Jalalayn |
| Hadith + gradings | Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Muwatta Malik, Nawawi 40, Hadith Qudsi, via [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) |
| Hisn al-Muslim (Arabic, with takhrij) | [rn0x/hisn_almuslim_json](https://github.com/rn0x/hisn_almuslim_json) |

`npm run data` downloads all of these into `public/data/` (about 60 MB). The
data is generated, not committed.

## Cost

| Part | Cost |
|---|---|
| Library, search, favorites | Free: static files, no server |
| AI | Free: [Ollama](https://ollama.com) running on your own computer. Any OpenAI-compatible server (e.g. LM Studio) also works. |
| Speech to text | Free: the browser's built-in speech recognition, or the Android keyboard's microphone |
| Website hosting | Free: GitHub Pages (`.github/workflows/web.yml`) |
| Android APK | Free: built on GitHub Actions (`.github/workflows/android.yml`). The Google Play listing is optional ($25 one-time). |

## Run it on your computer

```bash
npm install
npm run data          # download the Quran / hadith / dua library
npm run web           # open the website at the address it prints
```

### Turn on the free AI (optional)

1. Install Ollama: https://ollama.com/download
2. Download a model: `ollama pull qwen2.5:3b` (about 2 GB). Use `qwen2.5:7b` if
   your computer has 16 GB of RAM or more; it gives better answers.
3. Let the website talk to it: start Ollama with `OLLAMA_ORIGINS=*`
   - Windows (PowerShell): `$env:OLLAMA_ORIGINS="*"; ollama serve`
   - Mac/Linux: `OLLAMA_ORIGINS="*" ollama serve`
4. In the app: ⚙︎ Settings → Test connection.

To use the AI from your phone, start Ollama with `OLLAMA_HOST=0.0.0.0` as well.
Then put your computer's IP address in Settings, e.g. `http://192.168.1.20:11434`.

## Project layout

```
scripts/build-data.mjs   downloads and packs the library into public/data
src/app/                 screens (Expo Router)
src/lib/search.ts        Arabic/English search over the library
src/lib/ai.ts            Ollama/OpenAI-compatible client, retrieval, citation checking, verify
src/lib/grades.ts        hadith grading summary
src/lib/topics.ts        curated topics (references only; text always comes from the data)
src/lib/i18n.ts          English + Arabic strings
```

## Next ideas
- Keep the library on the phone after the first download (offline mode)
- English translation of Hisn al-Muslim
- Meaning-based (semantic) search
- Recitation audio, morning/evening reminders, prayer times
- Whisper speech-to-text for recorded clips
