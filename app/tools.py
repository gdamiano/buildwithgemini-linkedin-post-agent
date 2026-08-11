import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional
import pandas as pd

try:
    from google.cloud import firestore
    FIRESTORE_AVAILABLE = True
except ImportError:
    FIRESTORE_AVAILABLE = False


LOCAL_CACHE_FILE = os.path.join("data", "posts_cache.json")


def _get_firestore_client() -> Optional[Any]:
    """Gets a Firestore client if configured, or returns None."""
    if not FIRESTORE_AVAILABLE:
        return None
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIRESTORE_PROJECT")
    if not project_id:
        return None
    try:
        return firestore.Client(project=project_id)
    except Exception:
        return None


def _load_local_cache() -> Dict[str, Any]:
    """Loads cached post analysis from local JSON file in data/ directory."""
    if os.path.exists(LOCAL_CACHE_FILE):
        try:
            with open(LOCAL_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_local_cache(data: Dict[str, Any]) -> None:
    """Saves post analysis to local JSON file in data/ directory."""
    try:
        os.makedirs(os.path.dirname(LOCAL_CACHE_FILE), exist_ok=True)
        with open(LOCAL_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving local cache: {e}")


def get_cached_post(post_hash: str) -> Optional[Dict[str, Any]]:
    """Lookup cached post analysis from Firestore or local cache."""
    cache = _load_local_cache()
    if post_hash in cache:
        return cache[post_hash]

    db = _get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("linkedin_posts").document(post_hash)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                cache[post_hash] = data
                _save_local_cache(cache)
                return data
        except Exception as e:
            print(f"Firestore lookup error: {e}")

    return None


def save_analyzed_post(post_hash: str, post_data: Dict[str, Any]) -> None:
    """Saves post analysis to Firestore and local cache."""
    cache = _load_local_cache()
    cache[post_hash] = post_data
    _save_local_cache(cache)

    db = _get_firestore_client()
    if db:
        try:
            db.collection("linkedin_posts").document(post_hash).set(post_data)
        except Exception as e:
            print(f"Firestore save error: {e}")


def _analyze_and_categorize_post(content: str, name: str, job_title: str) -> tuple[str, str, str, str]:
    """Categorizes topic, post summary, sentiment, and sentiment reason for a post."""
    text = (content + " " + (job_title if job_title != "N/A" else "")).lower()

    # 1. Topic Categorization
    if any(k in text for k in ["hiring", "we're hiring", "we are hiring", "open role", "join our team", "looking for a", "hiring for", "job opening"]):
        topic = "Career & Hiring Opportunities"
    elif any(k in text for k in ["design", "ux", "ui", "voice ux", "user experience", "product design", "design system"]):
        topic = "Product Design & UX"
    elif any(k in text for k in ["ai", "llm", "gemini", "gpt", "model", "machine learning", "rag", "generative", "ai voice"]):
        topic = "AI & Machine Learning"
    elif any(k in text for k in ["cloud", "gcp", "aws", "azure", "architecture", "devops", "kubernetes", "infrastructure"]):
        topic = "Cloud & Infrastructure"
    elif any(k in text for k in ["product", "saas", "strategy", "b2b", "head of", "startup", "growth", "founder"]):
        topic = "Product Strategy & Leadership"
    else:
        topic = "Industry Insights & Updates"

    # 2. Post Summary Generation (including hiring title at company)
    words = content.strip().split()
    is_hiring = any(k in text for k in ["hiring", "we're hiring", "we are hiring", "join our team", "open role"])
    if is_hiring:
        role = job_title if (job_title and job_title != "N/A" and job_title != "nan") else "candidates"
        company = "our team"
        if " at " in content:
            match = re.search(r'at\s+([A-Z][A-Za-z0-9\s]+)', content)
            if match:
                company = match.group(1).strip().split('\n')[0][:25]
        summary = f"Hiring {role} at {company}."
    elif len(words) <= 20:
        summary = " ".join(words)
    else:
        summary = " ".join(words[:18]) + "..."

    # 3. Sentiment & Reason
    if any(k in text for k in ["excited", "great", "thrilled", "congrats", "launch", "awesome", "proud", "welcome", "best"]):
        sentiment = "Positive"
        reason = "Expresses optimism, enthusiasm, or celebrates achievements."
    elif any(k in text for k in ["frustrating", "issue", "down", "problem", "warning", "fail", "hard", "difficult"]):
        sentiment = "Negative"
        reason = "Addresses industry challenges or operational issues."
    else:
        sentiment = "Neutral"
        reason = "Informational update or professional announcement."

    return topic, summary, sentiment, reason


def read_linkedin_file(file_path: str) -> str:
    """Reads a LinkedIn posts file (.xlsx or .csv), extracts URLs, metadata, and auto-analyzes uncached posts directly into cache.
    
    Args:
        file_path: The file path or filename (e.g., "data/my_posts.csv" or "my_posts.xlsx").

    Returns:
        JSON string containing extracted post metadata and cached analyses.
    """
    target_path = file_path
    if not os.path.exists(target_path):
        data_dir_path = os.path.join("data", file_path)
        if os.path.exists(data_dir_path):
            target_path = data_dir_path

    if not os.path.exists(target_path):
        return json.dumps({"error": f"File not found at path '{file_path}' or inside 'data/{file_path}'."})

    file_ext = os.path.splitext(target_path)[1].lower()

    try:
        if file_ext == ".csv":
            df = pd.read_csv(target_path)
        elif file_ext in [".xlsx", ".xls"]:
            df = pd.read_excel(target_path)
        else:
            try:
                df = pd.read_csv(target_path)
            except Exception:
                df = pd.read_excel(target_path)
    except Exception as e:
        return json.dumps({"error": f"Failed to read file '{target_path}': {str(e)}"})

    if df.empty:
        return json.dumps({"message": "File is empty."})

    col_map = {str(col).lower().strip(): col for col in df.columns}

    # Precise priority candidate matching
    date_col = None
    for cand in ["created date", "published date", "date", "time", "created"]:
        matched = next((col_map[k] for k in col_map if cand in k), None)
        if matched:
            date_col = matched
            break

    name_col = None
    for cand in ["author", "full name", "creator", "user", "name", "person"]:
        matched = next((col_map[k] for k in col_map if cand in k), None)
        if matched:
            name_col = matched
            break

    title_col = None
    for cand in ["headline", "job title", "title", "role", "position"]:
        matched = next((col_map[k] for k in col_map if cand in k), None)
        if matched:
            title_col = matched
            break

    post_link_col = None
    for cand in ["post link", "link to post", "permalink", "sharelink", "post_url", "url", "link"]:
        matched = next((col_map[k] for k in col_map if cand in k), None)
        if matched:
            post_link_col = matched
            break

    content_col = None
    for cand in ["post text", "content", "post_content", "body", "text", "message", "post"]:
        matched = next((col_map[k] for k in col_map if cand in k and "link" not in k and "url" not in k), None)
        if matched:
            content_col = matched
            break

    if not content_col and len(df.columns) > 0:
        content_col = df.columns[0]

    processed_posts = []
    cache = _load_local_cache()

    for idx, row in df.iterrows():
        post_date = str(row[date_col]) if date_col and pd.notna(row[date_col]) else "N/A"
        author_name = str(row[name_col]) if name_col and pd.notna(row[name_col]) else "Unknown"
        job_title = str(row[title_col]) if title_col and pd.notna(row[title_col]) else "N/A"
        post_link = str(row[post_link_col]) if post_link_col and pd.notna(row[post_link_col]) else ""
        post_content = str(row[content_col]) if content_col and pd.notna(row[content_col]) else ""

        embedded_urls = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', post_content)
        embedded_urls = list(dict.fromkeys([url.rstrip('.,;)!?') for url in embedded_urls]))
        
        if post_link:
            embedded_urls = [u for u in embedded_urls if u != post_link]
            
        link_inside_post = ", ".join(embedded_urls) if embedded_urls else "None"

        hash_input = f"{post_link}|{post_date}|{author_name}|{post_content[:200]}"
        post_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:16]

        cached = cache.get(post_hash)

        if not cached:
            topic, summary, sentiment, reason = _analyze_and_categorize_post(post_content, author_name, job_title)
            cached = {
                "post_id": post_hash,
                "date": post_date,
                "name": author_name,
                "job_title": job_title,
                "post_summary": summary,
                "link_inside_post": link_inside_post,
                "link_to_post": post_link,
                "topic": topic,
                "sentiment": sentiment,
                "sentiment_reason": reason,
                "content_snippet": post_content[:300] + "..." if len(post_content) > 300 else post_content
            }
            save_analyzed_post(post_hash, cached)

        processed_posts.append(cached)

    return json.dumps({
        "total_posts": len(processed_posts),
        "file_source": target_path,
        "posts": processed_posts
    }, indent=2)


def save_batch_post_analyses(analyzed_posts_json: str) -> str:
    """Saves the analyzed post details and metadata to Firestore and local persistence cache.

    Args:
        analyzed_posts_json: JSON string containing a list of analyzed post objects with fields:
                             post_id, date, name, job_title, post_summary, link_inside_post, link_to_post, topic, sentiment, sentiment_reason.

    Returns:
        Confirmation message.
    """
    try:
        posts = json.loads(analyzed_posts_json)
        if isinstance(posts, dict) and "posts" in posts:
            posts = posts["posts"]
        
        saved_count = 0
        for p in posts:
            post_id = p.get("post_id")
            if post_id:
                save_analyzed_post(post_id, p)
                saved_count += 1
        return f"Successfully persisted {saved_count} analyzed posts to Firestore and local cache."
    except Exception as e:
        return f"Error persisting post analysis: {str(e)}"


def export_cleaned_posts_to_excel(output_filename: str = "cleaned_linkedin_posts.xlsx") -> str:
    """Exports all cached/analyzed posts to an Excel or CSV file in the data/ directory.

    Args:
        output_filename: Path or name of the output file (defaults to data/cleaned_linkedin_posts.xlsx).

    Returns:
        Path to the saved file.
    """
    cache = _load_local_cache()
    if not cache:
        return "No analyzed posts found in cache to export."

    if not os.path.dirname(output_filename):
        os.makedirs("data", exist_ok=True)
        output_filename = os.path.join("data", output_filename)

    rows = []
    for post_id, data in cache.items():
        rows.append({
            "Date": data.get("date", "N/A"),
            "Topic": data.get("topic", "Uncategorized"),
            "Name": data.get("name", "Unknown"),
            "Job Title": data.get("job_title", "N/A"),
            "Post Summary": data.get("post_summary", ""),
            "Link Inside Post": data.get("link_inside_post", "None"),
            "Link To Post": data.get("link_to_post", ""),
            "Sentiment": data.get("sentiment", "Neutral"),
            "Sentiment Reason": data.get("sentiment_reason", ""),
        })

    df = pd.DataFrame(rows)
    column_order = ["Date", "Topic", "Name", "Job Title", "Post Summary", "Link Inside Post", "Link To Post", "Sentiment", "Sentiment Reason"]
    df = df.reindex(columns=column_order)

    df.sort_values(by=["Topic", "Sentiment"], inplace=True, ignore_index=True)

    try:
        if output_filename.lower().endswith(".csv"):
            df.to_csv(output_filename, index=False)
        else:
            if not output_filename.lower().endswith(".xlsx"):
                output_filename += ".xlsx"
            df.to_excel(output_filename, index=False, engine="openpyxl")
        abs_path = os.path.abspath(output_filename)
        return f"Successfully exported {len(rows)} analyzed posts to file at: {abs_path}"
    except Exception as e:
        return f"Failed to export file: {str(e)}"
