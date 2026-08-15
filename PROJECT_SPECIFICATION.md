# 📌 LinkedIn Saved Posts Browser (SPB) — Reproduction & Feature Specification

> **Purpose**: This document contains the end-to-end technical, architectural, schema, and UI specifications for the **LinkedIn Saved Posts Browser (SPB)**. It serves as the complete source of truth for **Google Antigravity IDE** (or any AI agent) to instantly understand and work with the codebase without performing costly full-repository file scans.

---

## 1. Executive Summary & Goals

The **LinkedIn Saved Posts Browser (SPB)** is a zero-cost, privacy-first single-page web application. It converts raw LinkedIn saved post spreadsheet exports (`.csv`, `.xlsx`, or `.xls`) or direct 1-Click JSON exports into a structured, topic-clustered, and searchable intelligence repository with interactive 1-click export capabilities.

**Core Principles:**
- **$0 Infrastructure & Hosting:** 100% browser-native static application deployed on GitHub Pages. No backend server, Docker, or paid cloud databases required.
- **Privacy-First On-Device AI:** Defaults to Chrome Built-in AI (`window.LanguageModel` / Gemini Nano) running on-device with 0 network calls. Also supports user-provided Google Gemini or OpenAI API keys stored in `localStorage`.
- **In-Browser Persistence (`IndexedDB`):** Deduplicates posts via SHA-256 content hashes and caches all LLM outputs locally on the user's device. Returning users instantly load their directory without consuming duplicate AI tokens.
- **1-Click Bookmarklet Integration:** Collects posts directly on LinkedIn via a sandboxed bookmarklet running on `https://www.linkedin.com/my-items/saved-posts/`. Bypasses cross-domain restrictions by automatically transferring data payloads under 5KB through encoded URL query strings, and offering secure native Blob JSON file downloads with timestamp naming for larger feeds.

---

## 2. Technical Stack & Dependencies

* **Frontend**: Vanilla HTML5, CSS3 (Custom design system), ES6 JavaScript (Modules).
* **Typography**: Google Fonts (*Outfit* for headings, *Inter* for body text).
* **Spreadsheet Parser & Exporter**: `SheetJS` (`xlsx.full.min.js` via CDN) for in-browser CSV/XLSX/XLS/JSON parsing and export.
* **On-Device LLM**: Chrome Built-in AI (`window.LanguageModel` / Prompt API for Gemini Nano).
* **Cloud LLM (Optional)**: Google Gemini API (`gemini-3.5-flash` or `gemini-3.5-flash-lite` via user's API Key) or OpenAI API (`gpt-4o-mini`, `o3-mini`, etc.).
* **Local Persistence**: Browser `IndexedDB` (`SPB_PostStore`) + SHA-256 (`crypto.subtle`).
* **Hosting Target**: GitHub Pages (Static root deployment).

---

## 3. Data Architecture & 8-Column Schema

Every processed post is normalized into an 8-column schema stored in `IndexedDB`:

| Column # | Field Name | Type | Description & Processing Rules |
| :--- | :--- | :--- | :--- |
| **1** | `Date` | String | Date created/saved (Format: `YYYY-MM-DD`). Automatically converts Excel serial dates or relative LinkedIn time stamps (e.g. `23h`, `1w`). |
| **2** | `Name & Title` | HTML | Author's full name (clickable link to their LinkedIn profile if `profileLink` exists) + headline/job title stacked below. |
| **3** | `Post Summary` | HTML | **5 to 20 word summary** of post content + Topic category pill tag stacked below.<br>⚠️ **Hiring Rule Constraint**: For hiring posts, summary MUST follow: `"Hiring [Job Title] at [Company]"`. |
| **4** | `Links` | HTML | Bullet points for direct permalink (`• Post ↗`) and embedded body URLs extracted via Regex (`• www.link.com ↗`). |
| **5** | `Sentiment & Analysis` | HTML | Colored badge (`Positive`, `Neutral`, `Negative`) on line 1, and 1-sentence contextual explanation on line 2. |
| **6** | `Read` | Checkbox | User-selected check state. Checking dims row text to grey and turns cell background light grey (`#f1f5f9`). Filterable via the "Read" and "Unread" topic chips. |
| **7** | `Star` | Button | Toggle button (`⭐` / `☆`). Starred posts save reminder status to `IndexedDB` and filter via "Star Posts" chip. |
| **8** | `Edit` | Button | Vector Pencil-on-Tag SVG button. Opens dropdown modal to change topic category or write in a custom topic. |

---

## 4. Key JavaScript Modules & File Map

```
buildwithgemini-linkedin-post-agent/
├── index.html         # Main SPA layout (Navbar, Ingest Posts tab, Browse Directory tab, Settings & Edit modals)
├── favicon.ico        # 32x32 ICO favicon
├── blue_pin.png       # High-res blue pushpin logo and tab icon asset
├── faqConfig.js       # Editable FAQ questions & answers array (easily editable in any text editor)
├── css/
│   └── styles.css     # Design system (Colors, 2-column side-by-side grid, topic chips, badges, modals, FAQ accordion)
└── js/
    ├── storage.js          # IndexedDB manager (`SPB_PostStore`), SHA-256 deduplication hash generator
    ├── fileParser.js       # SheetJS parser for CSV/XLSX/XLS/JSON, Excel date code converter, body URL Regex extractor
    ├── aiService.js        # Pluggable LLM adapter (Gemini on-device, Gemini/OpenAI cloud keys, Mock simulator)
    ├── extensionBridge.js  # postMessage bridge manager for Chrome Extension interaction & Collect Posts Wizard
    ├── bookmarklet.js      # 1-Click Bookmarklet code generator with multi-container scrolling & DOM collector overlay
    └── app.js              # Main UI controller, Collect Posts Wizard modal, parallel batching, URL parameters importer
```

---

## 5. AI System Prompt & Constraints

Located in `js/aiService.js`:

```text
Output MUST be a valid JSON object matching this schema exactly:
{
  "topic": "Concise topic group (e.g. Hiring, Job Search Advice, AI & Machine Learning, Cloud & Infrastructure, Product Design & UX, Product Strategy & Leadership, Industry Insights). IMPORTANT TOPIC RULES: 1. Posts offering actual open jobs/roles MUST have the distinct topic tag 'Hiring'. 2. Posts containing career guidance, resume tips, or job hunting advice without an explicit job opening offered MUST have the topic tag 'Job Search Advice'.",
  "postSummary": "5 to 20 word summary of post content. IMPORTANT HIRING RULE: If this is a hiring/recruitment post, format as 'Hiring [Job Title] at [Company]'",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "sentimentReason": "1-sentence contextual explanation for the sentiment rating"
}
```

---

## 6. Performance & Optimization Features

1. **Parallel Concurrency Batching:** Processes posts in parallel batches of 3 (`BATCH_SIZE = 3`) to maximize LLM throughput.
2. **Instant Non-LLM File Preview:** Ingesting a file instantly calculates total, unique, and cached rows before any LLM calls start.
3. **Max Row Processing Limit:** Allows users to cap LLM execution (e.g., process top 20 rows of a 50-row file).
4. **Zero-Step URL Query Transfer:** Bookmarklet automatically encodes and transfers small datasets directly to the app via URL query string, saving file downloading steps.
5. **Robust DOM-Scraping Selectors:** Bookmarklet uses text-length inspections and layout checks to capture 100% of posts under various viewport configurations, including posts containing embeds.
6. **Smart Scroll Targets:** Automatically scrolls both window and nested layouts (e.g., `.scaffold-layout__main`) to trigger lazy-loaded items under different LinkedIn DOM updates.

---

## 7. Historical Release Archive

The original cloud-native Python/FastAPI/Firestore prototype is preserved in:
- **GitHub Release Tag:** `v0.1.0-gcp-prototype`
- **Archive Branch:** `archive/original-gcp-prototype`
- **Stable Bookmarklet Snapshot:** `v0.2.0-manual-import-stable` (Tag snapshot before direct URL parameters extraction)
