import json
import os
import shutil
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from app.agent import app as adk_app
from app.tools import export_cleaned_posts_to_excel, read_linkedin_file, _load_local_cache, LOCAL_CACHE_FILE


app = FastAPI(title="LinkedIn Saved Posts Curator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
os.makedirs(static_dir, exist_ok=True)

session_service = InMemorySessionService()
runner = Runner(
    app=adk_app,
    session_service=session_service,
)


class ProcessRequest(BaseModel):
    filename: str


@app.get("/api/files")
def list_files():
    """Lists all .xlsx, .xls, and .csv files available in the data/ directory."""
    files = []
    if os.path.exists(DATA_DIR):
        for f in sorted(os.listdir(DATA_DIR)):
            if f.lower().endswith((".xlsx", ".xls", ".csv")) and not f.startswith("~$"):
                files.append(f)
    return {"files": files}


@app.get("/api/posts")
def get_all_posts():
    """Returns all accumulated saved/analyzed post data from storage across all sessions."""
    cache = _load_local_cache()
    posts = list(cache.values()) if cache else []
    return {"total_posts": len(posts), "posts": posts}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Uploads an .xlsx, .xls, or .csv file directly into the data/ directory."""
    filename = file.filename
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, or .csv files are supported.")
    
    clean_filename = os.path.basename(filename)
    target_path = os.path.join(DATA_DIR, clean_filename)
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"message": f"Successfully uploaded '{clean_filename}'", "filename": clean_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@app.post("/api/process")
async def process_file(req: ProcessRequest):
    """Processes a file in data/ directory instantly and returns structured 8-column results."""
    filename = req.filename
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found in data/ directory.")

    # 1. Instantly parse and auto-analyze all rows into cache
    read_linkedin_file(filename)

    # 2. Trigger agent session for ADK runner lifecycle
    session_id = f"web_session_{os.urandom(4).hex()}"
    try:
        await session_service.create_session(
            app_name="app",
            user_id="web_user",
            session_id=session_id
        )
        msg = types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"Process file {filename}")]
        )
        async for event in runner.run_async(
            user_id="web_user",
            session_id=session_id,
            new_message=msg,
        ):
            pass
    except Exception as e:
        print(f"Runner info: {e}")

    # 3. Return all accumulated stored post data instantly
    cache = _load_local_cache()
    accumulated_posts = list(cache.values()) if cache else []

    return {
        "filename": filename,
        "final_text": "Successfully processed file.",
        "parsed_data": {"posts": accumulated_posts},
    }


@app.post("/api/reset")
def reset_saved_data():
    """Wipes saved post cache data so processing can be tested from scratch."""
    try:
        cache_path = os.path.abspath(LOCAL_CACHE_FILE)
        if os.path.exists(cache_path):
            os.remove(cache_path)
        return {"message": "Successfully reset saved analysis cache."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset cache: {str(e)}")


@app.get("/api/export")
def export_data(format: str = "xlsx"):
    """Exports cached analyzed posts as a downloadable Excel or CSV file."""
    output_filename = f"cleaned_linkedin_posts.{format}"
    result = export_cleaned_posts_to_excel(output_filename)
    
    file_path = os.path.join(DATA_DIR, output_filename)
    if not os.path.exists(file_path):
        file_path = output_filename

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail=f"Failed to generate export file: {result}")

    media_type = "text/csv" if format == "csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return FileResponse(file_path, filename=output_filename, media_type=media_type)


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Fallback route that serves index.html for root and proxy preview paths."""
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="index.html not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
