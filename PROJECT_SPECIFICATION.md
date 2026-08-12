# 📌 LinkedIn Saved Posts Browser (SPB) — Reproduction & Feature Specification

> **Purpose**: This document contains the end-to-end technical, architectural, schema, and UI specifications for the **LinkedIn Saved Posts Browser (SPB)**. It serves as the complete source of truth for **Google Antigravity IDE** (or any AI agent) to instantly understand and work with the codebase without performing costly full-repository file scans.

---

## 1. Executive Summary & Goals

The **LinkedIn Saved Posts Browser (SPB)** is a zero-cost, privacy-first single-page web application. It converts raw LinkedIn saved post spreadsheet exports (`.csv` or `.xlsx`) into a structured, topic-clustered, and searchable intelligence repository with interactive 1-click export capabilities.

**Core Principles:**
- **$0 Infrastructure & Hosting:** 100% browser-native static application deployed on GitHub Pages. No backend server, Docker, or paid cloud databases required.
- **Privacy-First On-Device AI:** Defaults to Chrome Built-in AI (`window.LanguageModel` / Gemini Nano) running on-device with 0 network calls. Also supports user-provided Google Gemini API keys stored in `localStorage`.
- **In-Browser Persistence (`IndexedDB`):** Deduplicates posts via SHA-256 content hashes and caches all LLM outputs locally on the user's device. Returning users instantly load their directory without consuming duplicate AI tokens.

---

## 2. Technical Stack & Dependencies

* **Frontend**: Vanilla HTML5, CSS3 (Custom design system), ES6 JavaScript (Modules).
* **Typography**: Google Fonts (*Outfit* for headings, *Inter* for body text).
* **Spreadsheet Parser & Exporter**: `SheetJS` (`xlsx.full.min.js` via CDN) for in-browser CSV/XLSX parsing and export.
* **On-Device LLM**: Chrome Built-in AI (`window.LanguageModel` / Prompt API for Gemini Nano).
* **Cloud LLM (Optional)**: Google Gemini REST API (`gemini-2.5-flash` via user's API Key).
* **Local Persistence**: Browser `IndexedDB` (`SPB_PostStore`) + SHA-256 (`crypto.subtle`).
* **Hosting Target**: GitHub Pages (Static root deployment).

---

## 3. Data Architecture & 8-Column Schema

Every processed post is normalized into an 8-column schema stored in `IndexedDB`:

| Column # | Field Name | Type | Description & Processing Rules |
| :--- | :--- | :--- | :--- |
| **1** | `Date` | String | Date created/saved (Format: `YYYY-MM-DD`). Automatically converts Excel serial dates (e.g. `46237.777`). |
| **2** | `Name & Title` | HTML | Author's full name (clickable link to their LinkedIn profile if `profileLink` exists) + headline/job title stacked below. |
| **3** | `Post Summary` | HTML | **5 to 20 word summary** of post content + Topic category pill tag stacked below.<br>⚠️ **Hiring Rule Constraint**: For hiring posts, summary MUST follow: `"Hiring [Job Title] at [Company]"`. |
| **4** | `Links` | HTML | Bullet points for direct permalink (`• Post ↗`) and embedded body URLs extracted via Regex (`• www.link.com ↗`). |
| **5** | `Sentiment & Analysis` | HTML | Colored badge (`Positive`, `Neutral`, `Negative`) on line 1, and 1-sentence contextual explanation on line 2. |
| **6** | `Read` | Checkbox | User-selected check state. Checking dims row text to grey and turns cell background light grey (`#f1f5f9`). |
| **7** | `Star` | Button | Toggle button (`⭐` / `☆`). Starred posts save reminder status to `IndexedDB` and filter via "Star Posts" chip. |
| **8** | `Edit` | Button | Vector Pencil-on-Tag SVG button. Opens dropdown modal to change topic category or write in a custom topic. |

---

## 4. Key JavaScript Modules & File Map

```
buildwithgemini-linkedin-post-agent/
├── index.html         # Main SPA layout (Navbar, Analyze File tab, Browse Posts tab, Settings & Edit modals)
├── favicon.ico        # 32x32 ICO favicon
├── blue_pin.png       # High-res blue pushpin logo and tab icon asset
├── faqConfig.js       # Editable FAQ questions & answers array (easily editable in any text editor)
├── css/
│   └── styles.css     # Design system (Colors, 2-column side-by-side grid, topic chips, badges, modals, FAQ accordion)
└── js/
    ├── storage.js     # IndexedDB manager (`SPB_PostStore`), SHA-256 deduplication hash generator
    ├── fileParser.js  # SheetJS parser for CSV/XLSX, Excel date code converter, body URL Regex extractor
    ├── aiService.js   # Pluggable LLM adapter (`LanguageModel` on-device, Gemini API key, Mock simulator)
    └── app.js         # Main UI controller, parallel batching (3x speedup), tab router, search filter, TOC chips, table renderer
```

---

## 5. AI System Prompt & Constraints

Located in `js/aiService.js`:

```text
Output MUST be a valid JSON object matching this schema exactly:
{
  "topic": "Concise topic group (e.g. AI & Machine Learning, Cloud & Infrastructure, Career & Hiring Opportunities, Product Design & UX, Product Strategy & Leadership, Industry Insights)",
  "postSummary": "5 to 20 word summary of post content. IMPORTANT HIRING RULE: If this is a hiring/recruitment post, format as 'Hiring [Job Title] at [Company]'",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "sentimentReason": "1-sentence contextual explanation for the sentiment rating"
}
```

---

## 6. Performance & Optimization Features

1. **Parallel Concurrency Batching:** Processes posts in parallel batches of 3 (`BATCH_SIZE = 3`) to maximize on-device LLM throughput (slashing runtime from 55s to ~15s per 10 posts).
2. **Instant Non-LLM File Preview:** Dragging a file into Step 1 instantly calculates total rows, unique new rows, and cached rows before any LLM calls start.
3. **Max Row Processing Limit:** Step 2 includes a `Max Rows to Process (LLM Limit)` input field allowing users to cap LLM execution (e.g. process top 20 rows of a 50-row file).
4. **Editable FAQ Config (`faqConfig.js`):** FAQ questions and answers are decoupled into `faqConfig.js` for easy plain-text editing.

---

## 7. Preservation of Original GCP Prototype

The original cloud-native Python/FastAPI/Firestore prototype is preserved in:
- **GitHub Release Tag:** `v0.1.0-gcp-prototype`
- **Archive Branch:** `archive/original-gcp-prototype`
