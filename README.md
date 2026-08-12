# LinkedIn Saved Post Browser (SPB)

> 📦 **Original Prototype Milestone:** 
> The original GCP Cloud Prototype (using Firestore & Cloud Storage) is preserved for reference. 
> You can download the [Original Prototype (.zip)](https://github.com/gdamiano/buildwithgemini-linkedin-post-agent/releases/tag/v0.1.0-gcp-prototype) or view the [`archive/original-gcp-prototype` branch](https://github.com/gdamiano/buildwithgemini-linkedin-post-agent/tree/archive/original-gcp-prototype).

A zero-cost, privacy-first, client-side web application for organizing, summarizing, and topic-clustering LinkedIn saved posts.

## 🚀 Key Features

* **Zero-Cost & Privacy-First:** Runs 100% locally in the user's web browser. No server infrastructure, Docker, or paid cloud databases needed.
* **On-Device & Modular AI:**
  * **Primary:** Chrome Built-in AI (`window.ai` / Gemini Nano) running locally on your device with 0 network calls.
  * **Secondary:** Google Gemini API (via user's free API key from Google AI Studio).
  * **Simulator Mode:** Offline testing mode for micro-testing.
* **IndexedDB Local Caching:** Automatically hashes post contents (`post_link|author|date`) and stores analyzed rows locally in browser `IndexedDB`. Closing the app and returning later restores all data instantly with zero LLM token usage!
* **8-Column Normalized Schema:** Normalizes dates, authors, headlines, summaries, body links, permalinks, and sentiment scoring with contextual explanations.
* **Hiring Rule Enforcement:** Automatically formats hiring posts as `"Hiring [Job Title] at [Company]"`.
* **Topic-Clustered Table of Contents (TOC):** Clickable filter chips (*Product Design & UX*, *AI & Machine Learning*, *Cloud & Infrastructure*, *Career & Hiring*, *Product Strategy*, etc.).
* **1-Click Export:** Download cleaned and analyzed repositories as `.csv` or `.xlsx` files.

---

## 🛠️ Project Structure

```
buildwithgemini-linkedin-post-agent/
├── index.html         # Main single-page web app entrypoint
├── css/
│   └── styles.css     # Design system (Inter & Outfit fonts, badges, dropzone, cards)
├── js/
│   ├── storage.js     # IndexedDB local cache manager (SHA-256 deduplication)
│   ├── fileParser.js  # SheetJS spreadsheet parser (.csv & .xlsx) + Body URL Regex
│   ├── aiService.js   # Pluggable AI adapter (window.ai, Gemini REST API, Mock)
│   └── app.js         # UI controller, tab router, search filter, and TOC renderer
└── data/
    └── linkedin_posts_sample.csv  # Sample input file for testing
```

---

## 🌐 Deployment to GitHub Pages

1. Go to your repository **Settings** on GitHub.
2. Under **Pages** (in the left sidebar), select:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `/ (root)`
3. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/` in 1-2 minutes!
