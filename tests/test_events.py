"""
Event ingestion + workflow engine tests.
Traceability: Epic KAN-88, Tasks KAN-89, KAN-90
"""
import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.event_store import EventStore
from backend.workflows import WorkflowEngine, build_default_engine

client = TestClient(main.app)

EVENT = {
    "type": "object_appeared",
    "label": "cup",
    "confidence": 0.87,
    "box": {"xmin": 0.1, "ymin": 0.2, "xmax": 0.4, "ymax": 0.6},
    "source": "pytest",
    "client_id": "device-1",
    "provider": "mock",
}


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    store = EventStore(":memory:")
    monkeypatch.setattr(main, "event_store", store)
    monkeypatch.setattr(main, "workflow_engine", build_default_engine(store))
    return store


def test_event_runs_identify_workflow():
    accepted = client.post("/api/events", json=EVENT)
    assert accepted.status_code == 202
    body = accepted.json()
    assert body["status"] == "queued"
    assert "identify_object" in body["detail"]

    # TestClient runs background tasks before returning, so the workflow is finished.
    record = client.get(f"/api/events/{body['id']}").json()
    assert record["status"] == "done"
    assert record["label"] == "cup"
    assert record["box"] == EVENT["box"]
    run = record["runs"][0]
    assert run["workflow"] == "identify_object"
    assert run["status"] == "succeeded"
    assert "Cup" in run["result"]["name"]
    assert run["finished_at"] >= run["started_at"]


def test_same_label_from_same_client_is_deduplicated():
    first = client.post("/api/events", json=EVENT).json()
    second = client.post("/api/events", json=EVENT).json()
    assert first["status"] == "queued"
    assert second["status"] == "deduplicated"
    assert client.get(f"/api/events/{second['id']}").json()["runs"] == []

    # A different client, or a different label, is not a duplicate.
    assert client.post("/api/events", json={**EVENT, "client_id": "device-2"}).json()["status"] == "queued"
    assert client.post("/api/events", json={**EVENT, "label": "laptop"}).json()["status"] == "queued"


def test_list_events_newest_first_and_filter():
    client.post("/api/events", json=EVENT)
    client.post("/api/events", json={**EVENT, "label": "laptop"})
    events = client.get("/api/events").json()
    assert [e["label"] for e in events] == ["laptop", "cup"]
    assert [e["label"] for e in client.get("/api/events?label=cup").json()] == ["cup"]
    assert client.get("/api/events/9999").status_code == 404


def test_image_is_stored_but_not_returned():
    body = client.post("/api/events", json={**EVENT, "image_b64": "data:image/jpeg;base64,AAAA"}).json()
    record = client.get(f"/api/events/{body['id']}").json()
    assert record["has_image"] is True
    assert "image_b64" not in record


def test_invalid_event_rejected():
    assert client.post("/api/events", json={**EVENT, "confidence": 1.5}).status_code == 422
    assert client.post("/api/events", json={**EVENT, "label": ""}).status_code == 422


@pytest.mark.anyio
async def test_failing_workflow_is_recorded_and_others_still_run():
    store = EventStore(":memory:")
    engine = WorkflowEngine(store)

    async def boom(payload):
        raise RuntimeError("tool unavailable")

    async def ok(payload):
        return {"seen": payload["label"]}

    engine.register("object_appeared", "boom", boom)
    engine.register("object_appeared", "ok", ok)

    from backend.schemas import DetectionEvent
    event_id = store.add(DetectionEvent(label="book", confidence=0.6))
    await engine.process(event_id)

    record = store.get(event_id)
    assert record.status == "failed"
    assert [(r.workflow, r.status) for r in record.runs] == [("boom", "failed"), ("ok", "succeeded")]
    assert "tool unavailable" in record.runs[0].error
    assert record.runs[1].result == {"seen": "book"}
