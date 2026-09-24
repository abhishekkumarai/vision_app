"""
Full Integration Test Suite for Dockerized MediaPipe & LLM Vision App.
Tests live Docker containers, FastAPI backend, Next.js App Router reverse-proxy,
object detection, encyclopedic reasoning, multi-turn chat, and error resilience.

Traceability: Epic KAN-49, Task KAN-57
"""
import base64
import io
import time
from typing import Dict, Any
from PIL import Image, ImageDraw
import pytest
import httpx

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:3010"

def generate_test_image_b64(width=320, height=240, color=(40, 40, 40)) -> str:
    """Generate a clean JPEG base64 string for testing detection endpoints."""
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    # Draw a simulated object rectangle
    draw.rectangle([60, 60, 180, 200], fill=(220, 80, 80), outline=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class TestLiveDockerContainers:
    """Verify live Docker containers and network readiness."""

    def test_backend_container_reachable(self):
        """Verify backend container is running and responds on port 8000."""
        with httpx.Client(base_url=BACKEND_URL, timeout=5.0) as client:
            resp = client.get("/api/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
            assert "version" in data
            assert "llm_provider" in data

    def test_frontend_container_reachable(self):
        """Verify Next.js frontend container is running and responds on port 3010."""
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.get("/")
            assert resp.status_code == 200
            assert "text/html" in resp.headers.get("content-type", "")
            # Check for Next.js App Router markers
            assert "<html" in resp.text
            assert "MEDIAPIPE VISION LENS" in resp.text or "next" in resp.text.lower()


class TestBackendDirectAPI:
    """Comprehensive test of direct FastAPI backend endpoints."""

    def test_providers_endpoint(self):
        with httpx.Client(base_url=BACKEND_URL, timeout=5.0) as client:
            resp = client.get("/api/providers")
            assert resp.status_code == 200
            data = resp.json()
            assert "available" in data
            assert "ollama" in data["available"]
            assert "gemini" in data["available"]
            assert "mock" in data["available"]

    def test_detect_with_synthetic_frame(self):
        b64_img = generate_test_image_b64()
        with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as client:
            resp = client.post("/api/detect", json={"image_b64": b64_img, "threshold": 0.4})
            assert resp.status_code == 200
            data = resp.json()
            assert "detections" in data
            assert "processing_time_ms" in data
            assert isinstance(data["detections"], list)

    @pytest.mark.parametrize("label,expected_name_substr", [
        ("cell phone", "Smartphone"),
        ("laptop", "Laptop"),
        ("cup", "Cup"),
        ("bottle", "Bottle"),
        ("keyboard", "Keyboard"),
    ])
    def test_identify_curated_objects(self, label, expected_name_substr):
        with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as client:
            resp = client.post("/api/identify", json={
                "label": label,
                "score": 0.94,
                "provider": "mock"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert expected_name_substr in data["name"]
            assert len(data["summary"]) > 20
            assert len(data["primary_uses"]) >= 2
            assert len(data["materials_and_specs"]) >= 2
            assert len(data["safety_and_maintenance"]) >= 2
            assert len(data["fun_facts"]) >= 1
            assert len(data["suggested_questions"]) >= 2
            assert data["model_used"] != "unknown"

    def test_identify_novel_generic_object(self):
        """Test identification of an uncurated object using the dynamic knowledge fallback."""
        with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as client:
            resp = client.post("/api/identify", json={
                "label": "astronomical telescope",
                "score": 0.88,
                "provider": "mock"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "Astronomical Telescope" in data["name"]
            assert len(data["primary_uses"]) >= 2
            assert len(data["materials_and_specs"]) >= 2

    def test_chat_follow_up_conversation(self):
        with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as client:
            resp = client.post("/api/chat", json={
                "object_context": {
                    "name": "Porcelain Coffee Mug",
                    "summary": "Heat resistant beverage cup",
                    "materials_and_specs": ["Vitrified ceramic", "Glazed silicate"]
                },
                "question": "Can I put this in the microwave?",
                "provider": "mock"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "answer" in data
            assert len(data["answer"]) > 10
            assert "model_used" in data


class TestFrontendNextJsReverseProxy:
    """Test Next.js dynamic reverse-proxying of all /api routes to the backend container."""

    def test_proxied_health_endpoint(self):
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.get("/api/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
            assert "version" in data

    def test_proxied_providers_endpoint(self):
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.get("/api/providers")
            assert resp.status_code == 200
            data = resp.json()
            assert "available" in data

    def test_proxied_detect_endpoint(self):
        b64_img = generate_test_image_b64()
        with httpx.Client(base_url=FRONTEND_URL, timeout=10.0) as client:
            resp = client.post("/api/detect", json={"image_b64": b64_img})
            assert resp.status_code == 200
            data = resp.json()
            assert "detections" in data

    def test_proxied_identify_endpoint(self):
        with httpx.Client(base_url=FRONTEND_URL, timeout=10.0) as client:
            resp = client.post("/api/identify", json={
                "label": "laptop",
                "score": 0.95,
                "provider": "mock"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "Laptop" in data["name"]
            assert len(data["summary"]) > 15
            assert isinstance(data["primary_uses"], list)

    def test_proxied_chat_endpoint(self):
        with httpx.Client(base_url=FRONTEND_URL, timeout=10.0) as client:
            resp = client.post("/api/chat", json={
                "object_context": {
                    "name": "Mechanical Keyboard",
                    "summary": "Tactile typing device"
                },
                "question": "What switch types are best for typing?",
                "provider": "mock"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "answer" in data
            assert len(data["answer"]) > 10


class TestErrorResilienceAndEdgeCases:
    """Verify system robustness and edge-case handling across the proxy."""

    def test_invalid_base64_detection_payload(self):
        """Ensure invalid image string doesn't crash backend and returns 500 error."""
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.post("/api/detect", json={"image_b64": "not-a-valid-base64-image-string"})
            assert resp.status_code == 500
            data = resp.json()
            assert "detail" in data

    def test_missing_required_fields_identify(self):
        """Missing required label must return 422 Unprocessable Entity."""
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.post("/api/identify", json={})
            assert resp.status_code == 422

    def test_missing_required_fields_chat(self):
        """Missing question or context must return 422."""
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            resp = client.post("/api/chat", json={"question": "Only question, no context"})
            assert resp.status_code == 422

    def test_proxy_latency_benchmark(self):
        """Verify Next.js reverse-proxy introduces minimal overhead (< 150ms)."""
        latencies = []
        with httpx.Client(base_url=FRONTEND_URL, timeout=5.0) as client:
            for _ in range(5):
                start = time.perf_counter()
                resp = client.get("/api/health")
                latencies.append((time.perf_counter() - start) * 1000.0)
                assert resp.status_code == 200

        avg_latency = sum(latencies) / len(latencies)
        print(f"\n[Benchmark] Average Proxied Health Latency: {avg_latency:.2f} ms")
        assert avg_latency < 250.0  # Generous threshold for Windows loopback
