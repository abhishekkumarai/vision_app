"""
End-to-End Test Suite for MediaPipe Vision & LLM App.
Traceability: Epic KAN-49, Task KAN-54
"""
import base64
import io
from PIL import Image, ImageDraw
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.detector import detector_instance
from backend.llm_service import llm_service_instance

client = TestClient(app)

def create_synthetic_test_image() -> str:
    """Create a simple RGB image with a shape for testing base64 endpoints."""
    img = Image.new("RGB", (320, 240), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 150, 180], fill=(200, 50, 50))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

def test_health_endpoint():
    """Verify system health, GPU detection, and MediaPipe readiness."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["mediapipe_ready"] is True
    assert "version" in data
    assert "gpu_available" in data

def test_providers_endpoint():
    """Verify provider options and current configuration."""
    response = client.get("/api/providers")
    assert response.status_code == 200
    data = response.json()
    assert "ollama" in data["available"]
    assert "mock" in data["available"]

def test_serve_index():
    """Verify frontend static root serves index.html."""
    response = client.get("/")
    assert response.status_code == 200
    assert "MEDIAPIPE VISION LENS" in response.text
    assert "text/html" in response.headers["content-type"]

def test_detect_endpoint():
    """Verify server-side MediaPipe detector endpoint."""
    b64_image = create_synthetic_test_image()
    response = client.post("/api/detect", json={"image_b64": b64_image})
    assert response.status_code == 200
    data = response.json()
    assert "detections" in data
    assert "processing_time_ms" in data
    assert isinstance(data["detections"], list)

def test_identify_endpoint():
    """Verify structured LLM encyclopedic insights generation."""
    response = client.post("/api/identify", json={
        "label": "laptop",
        "score": 0.92,
        "provider": "mock"
    })
    assert response.status_code == 200
    data = response.json()
    assert "Laptop" in data["name"]
    assert len(data["summary"]) > 20
    assert len(data["primary_uses"]) >= 2
    assert len(data["materials_and_specs"]) >= 2
    assert len(data["safety_and_maintenance"]) >= 2
    assert len(data["fun_facts"]) >= 1
    assert len(data["suggested_questions"]) >= 2

def test_chat_endpoint():
    """Verify contextual Q&A conversation about tracked object."""
    response = client.post("/api/chat", json={
        "object_context": {
            "name": "Smartphone",
            "summary": "Handheld cellular device",
            "materials_and_specs": ["OLED display", "Lithium battery"]
        },
        "question": "How long does the battery last?",
        "provider": "mock"
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 10
    assert "model_used" in data
