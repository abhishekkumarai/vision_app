"""
Workflow engine v1: routes detection events to registered workflows and records each run.
Traceability: Epic KAN-88, Task KAN-90

A workflow is an async function `(payload: dict) -> dict` registered for one or more event
types. The engine runs every workflow registered for the event's type, sequentially, and
stores a WorkflowRun (status, timings, result or error) on the event. Later workflows can
chain tool calls / actions (notifications, Jira, email — see KAN-94) the same way.
"""
import time
from typing import Any, Awaitable, Callable, Dict, List

from backend.event_store import EventStore
from backend.llm_service import llm_service_instance
from backend.schemas import WorkflowRun

Workflow = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


class WorkflowEngine:
    def __init__(self, store: EventStore):
        self.store = store
        self._registry: Dict[str, List[tuple[str, Workflow]]] = {}

    def register(self, event_type: str, name: str, fn: Workflow) -> None:
        self._registry.setdefault(event_type, []).append((name, fn))

    def workflows_for(self, event_type: str) -> List[str]:
        return [name for name, _ in self._registry.get(event_type, [])]

    async def process(self, event_id: int) -> None:
        payload = self.store.get_payload(event_id)
        if payload is None:
            return
        workflows = self._registry.get(payload["type"], [])
        if not workflows:
            self.store.set_status(event_id, "done")
            return

        self.store.set_status(event_id, "running")
        failed = False
        for name, fn in workflows:
            started = time.time()
            try:
                result = await fn(payload)
                run = WorkflowRun(workflow=name, status="succeeded", started_at=started,
                                  finished_at=time.time(), result=result)
            except Exception as e:  # a failing workflow must not take the others down
                failed = True
                run = WorkflowRun(workflow=name, status="failed", started_at=started,
                                  finished_at=time.time(), error=f"{type(e).__name__}: {e}")
            self.store.append_run(event_id, run)
        self.store.set_status(event_id, "failed" if failed else "done")


# ---------------------------------------------------------------------------
# Built-in workflows
# ---------------------------------------------------------------------------

async def identify_object_workflow(payload: Dict[str, Any]) -> Dict[str, Any]:
    """LLM identification of the object, using the client's crop when available."""
    insights = await llm_service_instance.identify_object(
        label=payload["label"],
        score=payload["confidence"],
        image_b64=payload.get("image_b64"),
        provider=payload.get("provider"),
    )
    return insights.model_dump()


def build_default_engine(store: EventStore) -> WorkflowEngine:
    engine = WorkflowEngine(store)
    engine.register("object_appeared", "identify_object", identify_object_workflow)
    return engine
