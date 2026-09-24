"""
Pydantic Schemas for Requests and Responses.
Traceability: Epic KAN-49, Task KAN-50
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    origin_x: float = Field(..., description="Top left X coordinate (pixels or normalized)")
    origin_y: float = Field(..., description="Top left Y coordinate (pixels or normalized)")
    width: float = Field(..., description="Box width")
    height: float = Field(..., description="Box height")

class DetectionItem(BaseModel):
    label: str = Field(..., description="Detected object label / class name")
    score: float = Field(..., description="Confidence score between 0.0 and 1.0")
    bounding_box: BoundingBox

class DetectionRequest(BaseModel):
    image_b64: str = Field(..., description="Base64 encoded image string (JPEG/PNG)")
    threshold: Optional[float] = Field(0.45, description="Score threshold")

class DetectionResponse(BaseModel):
    detections: List[DetectionItem]
    count: int
    processing_time_ms: float
    image_width: int = Field(0, description="Width of the analysed frame in pixels (bounding boxes are in this pixel space)")
    image_height: int = Field(0, description="Height of the analysed frame in pixels")

class IdentifyRequest(BaseModel):
    label: str = Field(..., description="Object name or label to identify")
    score: Optional[float] = Field(None, description="Detection confidence score")
    image_b64: Optional[str] = Field(None, description="Optional base64 cropped snapshot of the object")
    provider: Optional[str] = Field(None, description="Override LLM provider ('ollama', 'gemini', 'mock')")

class ObjectInsights(BaseModel):
    model_config = {"protected_namespaces": ()}

    name: str = Field(..., description="Full specific name of the object")
    category: str = Field(..., description="High-level category (e.g., Electronics, Tool, Food, Furniture)")
    summary: str = Field(..., description="Concise, captivating 2-3 sentence overview")
    primary_uses: List[str] = Field(default_factory=list, description="Common applications and functions")
    materials_and_specs: List[str] = Field(default_factory=list, description="Material composition, dimensions, or technical specifications")
    safety_and_maintenance: List[str] = Field(default_factory=list, description="Usage guidelines, handling care, safety notes")
    fun_facts: List[str] = Field(default_factory=list, description="Surprising facts, trivia, or historical origins")
    suggested_questions: List[str] = Field(default_factory=list, description="2-3 intriguing follow-up questions")
    model_used: str = Field("unknown", description="Model that produced these insights")

class ChatRequest(BaseModel):
    object_context: Dict[str, Any] = Field(..., description="Insights dictionary of the object being discussed")
    question: str = Field(..., description="User's question about the object")
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Previous messages")
    provider: Optional[str] = Field(None, description="Override LLM provider")

class ChatResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    answer: str
    model_used: str

class HealthResponse(BaseModel):
    status: str
    version: str
    llm_provider: str
    mediapipe_ready: bool
    gpu_available: bool
    gpu_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Event-driven workflows (Epic KAN-88: KAN-89, KAN-90)
# ---------------------------------------------------------------------------

class EventBox(BaseModel):
    """Normalized (0..1) box, same convention as the clients."""
    xmin: float = Field(..., ge=0.0, le=1.0)
    ymin: float = Field(..., ge=0.0, le=1.0)
    xmax: float = Field(..., ge=0.0, le=1.0)
    ymax: float = Field(..., ge=0.0, le=1.0)

class DetectionEvent(BaseModel):
    type: str = Field("object_appeared", description="Event type; routes to workflows")
    label: str = Field(..., min_length=1, description="Detected class label")
    confidence: float = Field(..., ge=0.0, le=1.0)
    box: Optional[EventBox] = None
    image_b64: Optional[str] = Field(None, description="Optional JPEG crop of the object (data URL or raw base64)")
    source: str = Field("unknown", description="Emitting client, e.g. 'nextjs', 'flutter-web'")
    client_id: str = Field("anonymous", description="Stable per-device id, used for dedupe")
    provider: Optional[str] = Field(None, description="LLM provider override for workflow steps")

class WorkflowRun(BaseModel):
    workflow: str
    status: str = Field(..., description="'succeeded' | 'failed'")
    started_at: float
    finished_at: float
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class EventRecord(BaseModel):
    id: int
    type: str
    label: str
    confidence: float
    box: Optional[EventBox] = None
    source: str
    client_id: str
    has_image: bool
    received_at: float
    status: str = Field(..., description="'queued' | 'running' | 'done' | 'failed' | 'deduplicated'")
    runs: List[WorkflowRun] = Field(default_factory=list)

class EventAccepted(BaseModel):
    id: Optional[int] = None
    status: str
    detail: Optional[str] = None
