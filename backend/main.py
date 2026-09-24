"""
FastAPI Main Application.
Traceability: Epic KAN-49, Task KAN-50, KAN-52
"""
import os
from pathlib import Path
try:
    import torch
    HAS_TORCH = True
except ImportError:
    torch = None
    HAS_TORCH = False
from typing import List, Optional
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.config import settings
from backend.detector import detector_instance
from backend.llm_service import llm_service_instance
from backend.event_store import EventStore
from backend.workflows import build_default_engine
from backend.schemas import (
    DetectionRequest,
    DetectionResponse,
    IdentifyRequest,
    ObjectInsights,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    DetectionEvent,
    EventAccepted,
    EventRecord,
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Real-Time MediaPipe Vision Tracking & LLM Intelligence Assistant"
)

# Enable CORS for local dev & webcam clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Event-driven workflows (Epic KAN-88)
event_store = EventStore(settings.EVENTS_DB_PATH)
workflow_engine = build_default_engine(event_store)

frontend_path = Path(settings.FRONTEND_DIR)
frontend_path.mkdir(parents=True, exist_ok=True)

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    gpu_ok = bool(HAS_TORCH and torch and torch.cuda.is_available())
    gpu_name = torch.cuda.get_device_name(0) if (gpu_ok and torch) else None
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        llm_provider=settings.LLM_PROVIDER,
        mediapipe_ready=detector_instance.is_ready(),
        gpu_available=gpu_ok,
        gpu_name=gpu_name
    )

@app.post("/api/detect", response_model=DetectionResponse)
async def detect_objects(req: DetectionRequest):
    """Detect objects in a base64 encoded frame using server-side MediaPipe."""
    if not detector_instance.is_ready():
        raise HTTPException(status_code=503, detail="MediaPipe detector not initialized")

    try:
        # MediaPipe inference is CPU-bound and synchronous: keep it off the event loop.
        detections, processing_time, (width, height) = await run_in_threadpool(
            detector_instance.detect_from_b64, req.image_b64
        )
        if req.threshold is not None:
            detections = [d for d in detections if d.score >= req.threshold]
        return DetectionResponse(
            detections=detections,
            count=len(detections),
            processing_time_ms=processing_time,
            image_width=width,
            image_height=height
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")

@app.post("/api/identify", response_model=ObjectInsights)
async def identify_object(req: IdentifyRequest):
    """Identify tracked object and generate structured encyclopedic intelligence via LLM."""
    try:
        insights = await llm_service_instance.identify_object(
            label=req.label,
            score=req.score,
            image_b64=req.image_b64,
            provider=req.provider
        )
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM identification error: {str(e)}")

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_object(req: ChatRequest):
    """Contextual conversational Q&A about the currently tracked object."""
    try:
        resp = await llm_service_instance.chat_about_object(
            object_context=req.object_context,
            question=req.question,
            history=req.history,
            provider=req.provider
        )
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@app.get("/api/providers")
async def list_providers():
    return {
        "current": settings.LLM_PROVIDER,
        "available": ["ollama", "gemini", "mock"],
        "ollama_model": settings.OLLAMA_MODEL,
        "gemini_model": settings.GEMINI_MODEL,
        "has_gemini_key": bool(settings.GEMINI_API_KEY)
    }

@app.post("/api/events", response_model=EventAccepted, status_code=202)
async def ingest_event(event: DetectionEvent, background: BackgroundTasks):
    """Accept a client detection event; matching workflows run asynchronously (KAN-89/90)."""
    if event_store.is_duplicate(event.client_id, event.label, settings.EVENT_COOLDOWN_SECONDS):
        event_id = event_store.add(event.model_copy(update={"image_b64": None}), status="deduplicated")
        return EventAccepted(id=event_id, status="deduplicated",
                             detail=f"'{event.label}' already reported by this client in the last "
                                    f"{settings.EVENT_COOLDOWN_SECONDS:.0f}s")
    event_id = event_store.add(event)
    background.add_task(workflow_engine.process, event_id)
    workflows = workflow_engine.workflows_for(event.type)
    return EventAccepted(id=event_id, status="queued",
                         detail=f"workflows: {', '.join(workflows) or 'none'}")

@app.get("/api/events", response_model=List[EventRecord])
async def list_events(limit: int = Query(50, ge=1, le=500), label: Optional[str] = None):
    """Most recent events first, with workflow runs and results."""
    return event_store.list(limit=limit, label=label)

@app.get("/api/events/{event_id}", response_model=EventRecord)
async def get_event(event_id: int):
    record = event_store.get(event_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return record

# Mount static frontend
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

@app.get("/")
async def serve_index():
    index_file = frontend_path / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse({"message": f"{settings.APP_NAME} API running. Visit /docs for OpenAPI specs."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
