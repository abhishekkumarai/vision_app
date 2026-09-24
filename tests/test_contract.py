"""
API contract tests: pin the exact request/response shapes every client
(Next.js, Flutter, static) depends on, so a client/backend mismatch fails CI
instead of silently returning 422s.
Traceability: Epic KAN-66, Tasks KAN-74, KAN-75, KAN-79
"""
from fastapi.testclient import TestClient

from backend.main import app
from backend.detector import detector_instance
from backend.llm_service import llm_service_instance
from backend.schemas import BoundingBox, DetectionItem

client = TestClient(app)


def _item(label: str, score: float) -> DetectionItem:
    return DetectionItem(
        label=label,
        score=score,
        bounding_box=BoundingBox(origin_x=10, origin_y=20, width=100, height=50),
    )


def test_detect_response_shape_and_threshold(monkeypatch):
    monkeypatch.setattr(
        detector_instance,
        "detect_from_b64",
        lambda b64: ([_item("cup", 0.9), _item("book", 0.5)], 12.5, (640, 480)),
    )
    response = client.post("/api/detect", json={"image_b64": "x", "threshold": 0.6})
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"detections", "count", "processing_time_ms", "image_width", "image_height"}
    assert (data["image_width"], data["image_height"]) == (640, 480)
    assert data["count"] == 1
    det = data["detections"][0]
    assert set(det) == {"label", "score", "bounding_box"}
    assert set(det["bounding_box"]) == {"origin_x", "origin_y", "width", "height"}
    assert det["label"] == "cup"


def test_detect_rejects_payload_without_image_b64():
    # The legacy Flutter client sent `image`; the contract field is `image_b64`.
    response = client.post("/api/detect", json={"image": "x"})
    assert response.status_code == 422


def test_identify_response_shape():
    response = client.post("/api/identify", json={"label": "cup", "score": 0.8, "provider": "mock"})
    assert response.status_code == 200
    assert set(response.json()) == {
        "name", "category", "summary", "primary_uses", "materials_and_specs",
        "safety_and_maintenance", "fun_facts", "suggested_questions", "model_used",
    }


def test_chat_response_shape_and_rejects_legacy_payload():
    ok = client.post("/api/chat", json={
        "object_context": {"name": "Cup"}, "question": "Is it dishwasher safe?", "provider": "mock",
    })
    assert ok.status_code == 200
    assert set(ok.json()) == {"answer", "model_used"}

    legacy = client.post("/api/chat", json={"message": "hi", "context_object": "cup"})
    assert legacy.status_code == 422


def test_chat_prompt_includes_history(monkeypatch):
    captured = {}

    async def fake_ollama(prompt, image_b64=None):
        captured["prompt"] = prompt
        return "It costs about $10."

    monkeypatch.setattr(llm_service_instance, "_query_ollama", fake_ollama)
    response = client.post("/api/chat", json={
        "object_context": {"name": "Cup"},
        "question": "How much does it cost?",
        "history": [
            {"role": "user", "content": "Is this cup ceramic?"},
            {"role": "assistant", "content": "Yes, it is glazed ceramic."},
        ],
        "provider": "ollama",
    })
    assert response.status_code == 200
    assert response.json()["answer"] == "It costs about $10."
    assert "User: Is this cup ceramic?" in captured["prompt"]
    assert "Assistant: Yes, it is glazed ceramic." in captured["prompt"]
