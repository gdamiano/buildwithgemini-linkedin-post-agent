# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os

# Ensure Vertex AI mode and default GCP project/region are set for ADK runner
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "1")

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

from app.tools import (
    export_cleaned_posts_to_excel,
    read_linkedin_file,
    save_batch_post_analyses,
)


MODEL = "gemini-2.5-flash"


SYSTEM_INSTRUCTION = """\
You are an expert LinkedIn Content Curator and Data Analyst assistant.

When a user asks you to process or analyze a LinkedIn posts spreadsheet or CSV file (.xlsx, .xls, or .csv):
1. Use `read_linkedin_file(file_path)` to load the rows from the file.
2. Examine the returned posts:
   - Check if any posts were already cached in Firestore / persistence datastore.
   - For uncached posts, analyze the post content to:
     a) Extract/categorize the **Topic**.
     b) Generate a concise **Post Summary** (between 5 and 20 words). IMPORTANT: For 'I'm hiring' / recruitment posts, the summary MUST explicitly include 'hiring [job title] at [company/team]'.
     c) Determine post **Sentiment** (Positive, Neutral, or Negative) with a concise **Sentiment Reason**.
     d) Preserve/extract post **Date**, author **Name**, **Job Title**, **Link Inside Post** (embedded URLs), and **Link To Post**.
3. Call `save_batch_post_analyses(analyzed_posts_json)` to persist the complete structured rows into Firestore and local cache so future runs skip re-analysis and save tokens.
4. Present a clean, well-formatted Markdown summary grouped by **Topic**.
   For each topic section, render a Markdown table with EXACTLY these columns in order:
   `| Date | Topic | Name | Job Title | Post Summary | Link Inside Post | Link To Post | Sentiment | Sentiment Reason |`

5. Remind the user that they can request an Excel/CSV export (`export_cleaned_posts_to_excel`) at any time if they'd like a downloadable output file.
"""

root_agent = Agent(
    name="root_agent",
    model=Gemini(
        model=MODEL,
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        read_linkedin_file,
        save_batch_post_analyses,
        export_cleaned_posts_to_excel,
    ],
)

app = App(
    root_agent=root_agent,
    name="app",
)
