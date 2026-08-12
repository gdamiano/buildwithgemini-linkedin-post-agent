# 📌 GEMINI.md — Agent Workspace Context & Instructions

This workspace contains the **LinkedIn Saved Post Browser (SPB)** project.

> ⚡ **AGENT QUICK CONTEXT:**
> Read this file and `PROJECT_SPECIFICATION.md` for full context on architecture, file structure, data schemas, and LLM integrations without needing to scan every raw source file.

---

## 1. Quick Project Overview

- **App Name:** LinkedIn Saved Post Browser (SPB)
- **Tech Stack:** Vanilla HTML5, CSS3, ES6 JavaScript, `SheetJS` (CSV/XLSX), `IndexedDB` storage.
- **Hosting Target:** GitHub Pages ($0 cost, client-side static SPA).
- **Primary AI Engine:** Chrome Built-in AI (`window.LanguageModel` / Gemini Nano on-device).
- **Secondary AI Engine:** Google Gemini REST API (`gemini-2.5-flash` via user's API Key).

---

## 2. Key File Directory

| File Path | Description & Purpose |
| :--- | :--- |
| **`index.html`** | Main Single Page Application structure (Navbar, Analyze File tab, Browse Posts tab, Settings & Category Edit modals). |
| **`css/styles.css`** | Complete design system (Colors, side-by-side grid, topic chips, badges, modals, FAQ accordion). |
| **`faqConfig.js`** | Plain-text array configuration for FAQ questions and answers. |
| **`js/storage.js`** | `IndexedDB` manager (`SPB_PostStore`) + 16-char SHA-256 deduplication hashing. |
| **`js/fileParser.js`** | `SheetJS` spreadsheet reader, Excel date code converter, and body link Regex extractor. |
| **`js/aiService.js`** | Pluggable LLM adapter (`LanguageModel`, Gemini REST API, Mock simulator). |
| **`js/app.js`** | Main UI controller, parallel batching (size=3), search filtering, TOC chips, and table rendering. |
| **`PROJECT_SPECIFICATION.md`** | Comprehensive architectural and 8-column data schema specification. |

---

## 3. Core Technical Conventions

1. **8-Column Table Layout:**
   `Date` | `Name & Title` | `Post Summary` | `Links` | `Sentiment & Analysis` | `Read` | `Star` | `Edit`
2. **Hiring Post Constraint:**
   Any recruitment post summary MUST follow format: `"Hiring [Job Title] at [Company]"`.
3. **Data Caching:**
   Posts are hashed as `post_link|author|date` and saved in `IndexedDB`. Never re-query AI for cached hashes.
4. **Concurrency:**
   `app.js` runs batch analysis in parallel promises of 3 (`BATCH_SIZE = 3`).

---

## 4. Git & Milestone References

- **Original GCP Prototype Release:** `v0.1.0-gcp-prototype`
- **Original GCP Archive Branch:** `archive/original-gcp-prototype`
- **Main Production Branch:** `main`
