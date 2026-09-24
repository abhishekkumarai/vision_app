"""
Persistent store for detection events and their workflow runs (SQLite, stdlib only).
Traceability: Epic KAN-88, Task KAN-89
"""
import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.schemas import DetectionEvent, EventBox, EventRecord, WorkflowRun

_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    label       TEXT NOT NULL,
    confidence  REAL NOT NULL,
    box         TEXT,
    image_b64   TEXT,
    source      TEXT NOT NULL,
    client_id   TEXT NOT NULL,
    provider    TEXT,
    received_at REAL NOT NULL,
    status      TEXT NOT NULL,
    runs        TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_events_dedupe ON events (client_id, label, received_at);
"""


class EventStore:
    def __init__(self, db_path: str):
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    # -- writes -------------------------------------------------------------
    def add(self, event: DetectionEvent, status: str = "queued") -> int:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO events (type, label, confidence, box, image_b64, source, client_id, provider, received_at, status)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    event.type,
                    event.label,
                    event.confidence,
                    event.box.model_dump_json() if event.box else None,
                    event.image_b64,
                    event.source,
                    event.client_id,
                    event.provider,
                    time.time(),
                    status,
                ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def set_status(self, event_id: int, status: str) -> None:
        with self._lock:
            self._conn.execute("UPDATE events SET status = ? WHERE id = ?", (status, event_id))
            self._conn.commit()

    def append_run(self, event_id: int, run: WorkflowRun) -> None:
        with self._lock:
            row = self._conn.execute("SELECT runs FROM events WHERE id = ?", (event_id,)).fetchone()
            if row is None:
                return
            runs = json.loads(row["runs"])
            runs.append(run.model_dump())
            self._conn.execute("UPDATE events SET runs = ? WHERE id = ?", (json.dumps(runs), event_id))
            self._conn.commit()

    # -- reads --------------------------------------------------------------
    def is_duplicate(self, client_id: str, label: str, cooldown_s: float) -> bool:
        """True if the same client already had a non-deduplicated event for this label recently."""
        with self._lock:
            row = self._conn.execute(
                "SELECT 1 FROM events WHERE client_id = ? AND label = ? AND status != 'deduplicated'"
                " AND received_at >= ? LIMIT 1",
                (client_id, label, time.time() - cooldown_s),
            ).fetchone()
        return row is not None

    def get_payload(self, event_id: int) -> Optional[Dict[str, Any]]:
        """Full row including the image, for workflow execution."""
        with self._lock:
            row = self._conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return dict(row) if row else None

    def get(self, event_id: int) -> Optional[EventRecord]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return self._to_record(row) if row else None

    def list(self, limit: int = 50, label: Optional[str] = None) -> List[EventRecord]:
        query, args = "SELECT * FROM events", []
        if label:
            query += " WHERE label = ?"
            args.append(label)
        query += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._conn.execute(query, args).fetchall()
        return [self._to_record(r) for r in rows]

    @staticmethod
    def _to_record(row: sqlite3.Row) -> EventRecord:
        return EventRecord(
            id=row["id"],
            type=row["type"],
            label=row["label"],
            confidence=row["confidence"],
            box=EventBox.model_validate_json(row["box"]) if row["box"] else None,
            source=row["source"],
            client_id=row["client_id"],
            has_image=bool(row["image_b64"]),
            received_at=row["received_at"],
            status=row["status"],
            runs=[WorkflowRun(**r) for r in json.loads(row["runs"])],
        )
