# Promptfoo Evaluation Pipeline Quickstart Guide

This document details how to run and configure the local Promptfoo evaluation pipeline for the LinkedIn Saved Posts Browser.

## Getting Started

### 1. Install Dependencies
Navigate into the project folder and install the local package dependencies:
```bash
npm install
```
*Note: You do not need to install Promptfoo globally or locally. The execution scripts use `npx` to run it automatically.*

### 2. Configure API Keys (Optional)
By default, the pipeline runs deterministic check assertions (Duplicate IDs, Date Parsing, Job Title existence). To enable the semantic LLM-rubric assertion (evaluating post summaries for high-value takeaways):

1. Create a `.env` file in the root of this folder (or duplicate `.env.example`).
2. Insert your developer Gemini API key from Google AI Studio:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```

---

## Running Evaluations

You can filter which rows of the database to test using terminal environment variables.

### A. Run All Test Cases
Evaluate every row in the sample database:

* **PowerShell**:
  ```powershell
  $env:FILTER_MODE="default"; npx promptfoo eval --no-cache; node summarize-evals.js
  ```
* **Command Prompt (cmd.exe)**:
  ```cmd
  set FILTER_MODE=default&& npx promptfoo eval --no-cache & node summarize-evals.js
  ```
* **macOS / Linux**:
  ```bash
  FILTER_MODE=default npx promptfoo eval --no-cache; node summarize-evals.js
  ```

### B. Run Between Row Index X and Y (Inclusive)
Evaluate a subset of rows by index range (e.g., from row index 2 through 5, inclusive):

* **PowerShell**:
  ```powershell
  $env:FILTER_MODE="range"; $env:FILTER_VALUE="2:5"; npx promptfoo eval --no-cache; node summarize-evals.js
  ```
* **Command Prompt (cmd.exe)**:
  ```cmd
  set FILTER_MODE=range&& set FILTER_VALUE=2:5&& npx promptfoo eval --no-cache & node summarize-evals.js
  ```

### C. Run Within a Date Range
Evaluate rows where the post date falls within a specific range (e.g., between August 11, 2026 and August 12, 2026, inclusive). Use the `YYYY-MM-DD` format separated by a colon:

* **PowerShell**:
  ```powershell
  $env:FILTER_MODE="date"; $env:FILTER_VALUE="2026-08-11:2026-08-12"; npx promptfoo eval --no-cache; node summarize-evals.js
  ```
* **Command Prompt (cmd.exe)**:
  ```cmd
  set FILTER_MODE=date&& set FILTER_VALUE=2026-08-11:2026-08-12&& npx promptfoo eval --no-cache & node summarize-evals.js
  ```

### D. Run a Specific Row ID
Evaluate a single record matching a specific string ID:

* **PowerShell**:
  ```powershell
  $env:FILTER_MODE="id"; $env:FILTER_VALUE="000000000000000b"; npx promptfoo eval --no-cache; node summarize-evals.js
  ```
* **Command Prompt (cmd.exe)**:
  ```cmd
  set FILTER_MODE=id&& set FILTER_VALUE=000000000000000b&& npx promptfoo eval --no-cache & node summarize-evals.js
  ```

---

## Viewing Results

Every time an evaluation completes, the runner automatically outputs reports directly to the `evals/` folder:
- **Interactive Web Interface**: [`evals/eval_report.html`](file:///c:/Users/pogoo/Documents/Cursor/LinkedIn%20Saved%20Post%20Browser/buildwithgemini-linkedin-post-agent/evals/eval_report.html)
- **Structured Data Export**: [`evals/eval_report.json`](file:///c:/Users/pogoo/Documents/Cursor/LinkedIn%20Saved%20Post%20Browser/buildwithgemini-linkedin-post-agent/evals/eval_report.json)

### Terminal Summary
After evaluations run, the results are summarized directly in the console using ANSI colors based on customizable thresholds:

```text
=== Evaluation Metrics Summary ===

Passing "Duplicate ID Check": 2 of 3 | 66%
Passing "Valid Date Check": 3 of 3 | 100%
Passing "Job Title Check": 3 of 3 | 100%
```

To view or reprint this summary at any time without running another test:
```bash
node summarize-evals.js
```

### Promptfoo Web Interface
To spin up Promptfoo's local server and analyze metrics in detail across different runs:
```bash
npx promptfoo view
```
