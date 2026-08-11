# 📌 LinkedIn Saved Posts Curator Agent — Reproduction & Feature Specification

> **Purpose**: This document contains the end-to-end technical, architectural, and UI specification for the **LinkedIn Saved Posts Curator Agent**. It is designed to serve as a complete prompt and blueprint for **Google Antigravity IDE** (or any AI agent) to reproduce the application identically from scratch.

---

## 1. Executive Summary & Goals

The **LinkedIn Saved Posts Curator Agent** is a full-stack AI application built with the **Google Agent Development Kit (ADK 2.x)**, **Gemini 2.5 Flash**, **FastAPI**, and a **custom Vanilla CSS/JS Web UI**. 

It converts raw, unorganized LinkedIn saved post spreadsheet exports (`.csv` or `.xlsx`) into a structured, topic-clustered, and searchable intelligence repository with 1-click export capabilities.

---

## 2. Technical Stack & Dependencies

* **Language**: Python 3.12+
* **LLM Engine**: `gemini-2.5-flash` via Google Vertex AI / Agent Development Kit (`google-adk>=0.2.0`)
* **Backend Framework**: `fastapi>=0.115.0`, `uvicorn>=0.34.0`, `pydantic`
* **Data Processing**: `pandas>=2.0.0`, `openpyxl>=3.1.0`
* **Persistence & Storage**: Local JSON Cache (`data/posts_cache.json`) + Optional GCP Firestore (`google-cloud-firestore`)
* **Frontend**: Single-Page Web Application (Vanilla HTML5, CSS3, ES6 JavaScript, Google Fonts: *Inter* & *Outfit*)
* **Deployment Target**: Google Cloud Run (Containerized via Dockerfile)

---

## 3. Data Architecture & 8-Column Schema

Every processed post is normalized into an 8-column schema:

| Column # | Field Name | Description & Processing Rules |
| :--- | :--- | :--- |
| **1** | `Date` | Date the post was created or saved (format: `YYYY-MM-DD` or `N/A`). |
| **2** | `Topic` | Categorized topic group (e.g., *Product Design & UX*, *AI & Machine Learning*, *Cloud & Infrastructure*, *Career & Hiring Opportunities*, *Product Strategy & Leadership*, *Industry Insights & Updates*). |
| **3** | `Name` | Author's full name. |
| **4** | `Job Title` | Author's headline or professional job title. |
| **5** | `Post Summary` | **5 to 20 word summary** of the post content.<br>⚠️ **Hiring Rule Constraint**: For "I'm hiring" posts, the summary **MUST** explicitly follow the format: `"Hiring [Job Title] at [Company]"`. |
| **6** | `Link Inside Post` | Extracted URLs contained within the body text (comma-separated if multiple, or `"None"`). |
| **7** | `Link To Post` | Direct URL / permalink to the original LinkedIn post. |
| **8** | `Sentiment` | **Merged Column Layout**: Displays a colored badge (`Positive`, `Neutral`, `Negative`) on line 1, and a 1-sentence contextual explanation on line 2. |

---

## 4. ADK Agent & Tool Definitions

The core agent is defined in `app/agent.py` using `google.adk.agents.Agent` and registered with three core tools in `app/tools.py`.

### System Prompt & Guidance (`app/agent.py`)
```python
SYSTEM_INSTRUCTION = """
You are an expert LinkedIn Content Curator AI Agent.
Your job is to read saved LinkedIn post spreadsheet files (.xlsx or .csv), process every post, categorize topics, extract embedded URLs, summarize content, and analyze sentiment.

Required Output Schema for each post:
1. Date: Post creation or save date.
2. Topic: Group into a concise topic category (e.g., AI & Machine Learning, Cloud & Infrastructure, Career & Hiring Opportunities, Product Design & UX, Product Strategy & Leadership).
3. Name: Author full name.
4. Job Title: Author headline or title.
5. Post Summary: A 5 to 20 word summary. FOR HIRING POSTS, YOU MUST FORMAT AS: "Hiring [Job Title] at [Company]".
6. Link Inside Post: Any URLs extracted from inside the body text (or "None").
7. Link To Post: Direct permalink URL to the LinkedIn post.
8. Sentiment & Sentiment Reason: Positive, Neutral, or Negative badge with a brief explanation.

Always use read_linkedin_file to load file data, auto-analyze posts, and persist them via save_batch_post_analyses.
"""
```

### Core Tools (`app/tools.py`)

1. **`read_linkedin_file(file_path: str)`**:
   * Reads `.xlsx` or `.csv` files from the `data/` directory.
   * Performs flexible priority column matching (`'created date'`, `'author'`, `'headline'`, `'post link'`, `'post text'`).
   * Extracts embedded body URLs via Regex.
   * Generates a 16-character SHA-256 hash input (`f"{post_link}|{post_date}|{author_name}|{post_content[:200]}"`).
   * If not already cached, performs fast automatic topic categorization, 5–20 word summary generation (enforcing hiring rules), URL extraction, and sentiment scoring, saving results directly to `data/posts_cache.json`.

2. **`save_batch_post_analyses(analyzed_posts_json: str)`**:
   * Accepts JSON string of analyzed posts and persists them to `data/posts_cache.json` and Firestore (`linkedin_posts` collection).

3. **`export_cleaned_posts_to_excel(output_filename: str)`**:
   * Generates downloadable `.xlsx` or `.csv` files sorted by `Topic` and `Sentiment`.

---

## 5. FastAPI Backend API Specification (`frontend/main.py`)

The backend is built with FastAPI and runs on port `8080`:

| Endpoint | Method | Input | Response / Action |
| :--- | :--- | :--- | :--- |
| **`/api/files`** | `GET` | None | Returns list of `.xlsx`, `.xls`, `.csv` files inside `data/`. |
| **`/api/upload`** | `POST` | Multipart Form (`file`) | Uploads file directly into `data/` directory. |
| **`/api/process`** | `POST` | `{"filename": "my_file.csv"}` | Instantly triggers `read_linkedin_file()`, auto-analyzes all uncached posts, runs ADK session runner, and returns all accumulated post records. |
| **`/api/posts`** | `GET` | None | Returns **all accumulated/cached post data** across all previous sessions from `data/posts_cache.json`. |
| **`/api/reset`** | `POST` | None | Wipes `data/posts_cache.json` so processing can be tested from scratch. |
| **`/api/export`** | `GET` | `?format=xlsx` or `?format=csv` | Generates and serves downloadable Excel or CSV file. |
| **`/{full_path:path}`**| `GET` | Any static path | Fallback handler that serves `frontend/static/index.html`. |

---

## 6. Frontend UI Specification (`frontend/static/index.html`)

### Design System & Styling
* **Theme**: Modern, clean, light-mode design system.
* **Palette**: Primary `#2563eb` (Royal Blue), Accent Green `#10b981`, Accent Red `#ef4444`, Neutral `#f8fafc` / `#0f172a`.
* **Typography**: Google Fonts *Outfit* (Headings) & *Inter* (Body).

### Navigation & Page Structure
1. **Top Header Bar**:
   * Sticky top bar featuring brand logo (`📌 LinkedIn Saved Posts Curator`) and dual page tabs:
     * **`📊 Analyze File`** (Page 1)
     * **`📑 Post Data`** (Page 2)

2. **Page 1: Input & Data Selection**:
   * **Step 1 Card**: Ingestion guide with external link (`View in Chrome Extensions Store`).
   * **Step 2 Card**: Interactive Drag & Drop uploader zone.
   * **Step 3 Card**: File select dropdown + full-width **`🔄 Refresh List`** button.
   * **Action Bar**:
     * **`Reset Saved Data 🗑️`** (Danger red outline button).
     * **`Process Selected File ✨`** (Primary blue button with spinner state).

3. **Page 2: Review & Results**:
   * **Top Action Bar**: `← Process Another File` button alongside `📥 Download All CSV` and `📥 Download All Excel (.xlsx)` buttons.
   * **Interactive Table of Contents (TOC)**:
     * Card header showing total post count (e.g. `📋 Table of Contents (50)`).
     * **`Collapse ▲ / Expand ▾`** toggle button.
     * Clickable rounded topic chips showing item counts (e.g. `📌 Product Design & UX (12)`).
   * **Topic-Grouped Result Tables**:
     * Section headers for each topic with count.
     * **7 Display Columns**: `Date` | `Name` | `Job Title` | `Post Summary` | `Link Inside Post` | `Link To Post` | `Sentiment`.
     * **Merged Sentiment Layout**: Colored pill badge on line 1 (`badge-positive`, `badge-neutral`, `badge-negative`), sentiment reason in muted smaller text on line 2.

---

## 7. Project Directory & File Layout

```
linkedin-post-agent/
├── agents-cli-manifest.yaml
├── Dockerfile
├── pyproject.toml
├── README.md
├── app/
│   ├── __init__.py
│   ├── agent.py          # ADK Agent definition & system instruction
│   └── tools.py          # read_linkedin_file, save_batch_post_analyses, export
├── data/
│   ├── linkedin_posts_sample.csv
│   └── posts_cache.json  # Persistent JSON post store
└── frontend/
    ├── main.py           # FastAPI proxy server
    └── static/
        └── index.html    # 2-Page Lightmode Web UI
```

---

## 8. Dockerfile Specification (`Dockerfile`)

```dockerfile
FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.8.13

WORKDIR /code

COPY ./pyproject.toml ./README.md ./uv.lock* ./

COPY ./app ./app
COPY ./frontend ./frontend
COPY ./data ./data

RUN uv sync --frozen

ARG AGENT_VERSION=0.0.0
ENV AGENT_VERSION=${AGENT_VERSION}

EXPOSE 8080

CMD ["uv", "run", "uvicorn", "frontend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 9. Reproduction Instructions for Google Antigravity IDE

To reproduce this exact application in Antigravity IDE:

1. **Scaffold Project**:
   ```bash
   agents-cli create linkedin-post-agent --template adk
   cd linkedin-post-agent
   agents-cli scaffold enhance . --deployment-target cloud_run
   ```

2. **Implement Backend Logic**:
   * Create `app/tools.py` with URL extraction, hash calculation, hiring rule enforcement, auto-categorization, and JSON/Firestore cache tools.
   * Create `app/agent.py` defining the ADK agent with `gemini-2.5-flash` and system instructions.

3. **Implement Web Frontend**:
   * Create `frontend/main.py` with FastAPI endpoints (`/api/files`, `/api/upload`, `/api/process`, `/api/posts`, `/api/reset`, `/api/export`).
   * Create `frontend/static/index.html` with the top header, Page 1 steps, Page 2 Table of Contents toggle, merged sentiment badges, and post summary columns.

4. **Verify Locally**:
   ```bash
   uv run python frontend/main.py
   ```
   Open `http://localhost:8080` to verify all steps and exports.

5. **Deploy to Cloud Run**:
   ```bash
   agents-cli deploy --deployment-target cloud_run --project <YOUR_PROJECT_ID> --region us-central1 --no-confirm-project
   gcloud run services add-iam-policy-binding linkedin-post-agent --region us-central1 --member="allUsers" --role="roles/run.invoker"
   ```
