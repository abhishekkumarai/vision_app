# LLM.md — vision_app quick orientation

Work tracking: [`TASKS.md`](TASKS.md) (Jira epic KAN-66 — features, bugs, backlog). Problems: [`troubleshoot.md`](troubleshoot.md).

Real-time "point your camera at something → detect it with MediaPipe → ask an LLM
what it is and chat about it" app. Goal statement: `goal.md`. Human README:
`README.md` (describes the Next.js edition only — the Flutter client is newer and
not in it).

## Layout at a glance

| Path | What | Status |
|---|---|---|
| `backend/` | FastAPI + MediaPipe Python + multi-provider LLM | the single shared API |
| `flutter_frontend/` | Flutter (web/Android/iOS) client, served by nginx on **:3020** | **newest, actively worked on** |
| `frontend/` | Next.js 14 client on **:3010** — same UX as Flutter, shadcn/ui + Tailwind | working |
| `frontend_static/` | vanilla HTML/JS fallback, served by the backend at `/` | legacy |
| `tests/` | `test_app.py` (unit, TestClient), `test_contract.py` (API shapes), `test_integration_full.py` (hits live :8000/:3010) | |
| `docker-compose.yml` | `backend`, `frontend`, `flutter-web` on network `vision-net` | |

Python tooling: **always `uv`** (per `goal.md`). `uv run pytest tests/test_app.py -v`,
`uv run uvicorn backend.main:app --port 8000 --reload`.

## Backend (`backend/`)

- `main.py` — routes: `GET /api/health`, `POST /api/detect`, `POST /api/identify`,
  `POST /api/chat`, `GET /api/providers`; serves `frontend_static/` at `/` and `/static`.
  CORS is `*`.
- `detector.py` — `MediaPipeDetector` singleton (`detector_instance`) wrapping
  MediaPipe Tasks `ObjectDetector` with `models/efficientdet_lite0.tflite`
  (auto-downloaded by `models/download_models.py`). Returns **pixel** boxes.
- `llm_service.py` — `LLMService` singleton: `identify_object()` and
  `chat_about_object()`. Providers: `ollama` (default `gemma2:2b`), `gemini`
  (`google-genai`, `gemini-2.5-flash`), `mock`/offline curated knowledge base. Falls
  back to offline/generic insights when a provider fails; `_extract_json` parses LLM output.
- `schemas.py` — the API contract (source of truth):
  - detect: req `{image_b64, threshold?}` → `{detections:[{label, score, bounding_box:{origin_x, origin_y, width, height}}], count, processing_time_ms}`
  - identify: req `{label, score?, image_b64?, provider?}` → `ObjectInsights {name, category, summary, primary_uses[], materials_and_specs[], safety_and_maintenance[], fun_facts[], suggested_questions[], model_used}`
  - chat: req `{object_context: dict, question, history?: [{role, content}], provider?}` → `{answer, model_used}` (last 8 history turns go into the prompt)
  - detect response also carries `image_width`, `image_height`; request `threshold` filters results (it can only raise the detector's 0.45 floor).
- `config.py` — pydantic-settings, reads `.env` (see `.env.example`). In Docker,
  Ollama is reached via `host.docker.internal:11434`.

## Event-driven workflows (Epic KAN-88)

Architecture: **detect on the device, run workflows on the server.** Clients send small,
debounced *events* instead of frames; WebRTC/RTSP ingest (KAN-95) is a later second event
source into the same pipeline.

- `POST /api/events` (202) takes `DetectionEvent {type='object_appeared', label, confidence,
  box (normalized), image_b64 crop?, source, client_id, provider?}`. Server-side dedupe: same
  `client_id`+`label` within `EVENT_COOLDOWN_SECONDS` (30 s) → stored as `deduplicated`, no workflow.
  `GET /api/events?limit&label`, `GET /api/events/{id}` return `EventRecord` with `runs[]`
  (the crop is stored but never returned — `has_image` only).
- `backend/event_store.py` — SQLite (stdlib), `EVENTS_DB_PATH` (default `backend/data/events.db`,
  Docker named volume `vision-events`).
- `backend/workflows.py` — `WorkflowEngine.register(event_type, name, async fn)`; runs every
  workflow for the event's type via FastAPI `BackgroundTasks`, records a `WorkflowRun`
  (status/timings/result/error) per workflow; one failure doesn't stop the others.
  Built-in: `identify_object` → `LLMService.identify_object` with the event crop.
  Add actions/integrations here (KAN-94).
- Clients: an *appearance tracker* (`frontend/lib/events.ts`,
  `flutter_frontend/lib/services/appearance_tracker.dart` — same rules: stable ≥700 ms,
  gap >500 ms resets, 30 s per-label cooldown) emits one event per newly stable object.
  Toggle "Send workflow events" in Settings (default on).

## Clients — where detection runs

- **Next.js** (`frontend/`) — deliberately mirrors the Flutter client's layout and flow
  (KAN-87). UI is shadcn/ui (`components/ui/*`, generated with `shadcn@2.3.0` because the
  project is on Tailwind v3 + React 18) themed with the Flutter palette in `app/globals.css`
  (HSL tokens; `--success` = emerald for selection/state).
  - `components/vision-provider.tsx` — React context, the counterpart of Flutter's
    `VisionProvider`: camera lifecycle (skips `NotReadableError` devices such as an idle OBS
    camera), detection loop, demo feed, identify (crops snapshot), chat, shared `view` state.
  - Detection runs **in-browser** (`@mediapipe/tasks-vision`, GPU then CPU delegate) every
    video frame; if MediaPipe can't load it **falls back to server `/api/detect`** every
    `detectIntervalMs` (`lib/api.ts`). Boxes are normalized 0..1 like Flutter's `Box2D`.
  - `components/app-shell.tsx` — ≥850px desktop (camera 3fr | Tabs 2fr) vs mobile bottom nav;
    only one layout renders so there is a single `<video>`; mobile screens stay mounted.
  - `camera-view.tsx`, `detection-overlay.tsx` (boxes are `<button>`s over an object-contain
    frame; no canvas, not mirrored), `object-card.tsx`, `chat-panel.tsx`, `status-bar.tsx`,
    `settings-dialog.tsx` (persists to localStorage).
  - All backend calls go through `app/api/[...path]/route.ts` (`BACKEND_URL=http://backend:8000`).
- **Flutter** (`flutter_frontend/lib/`): uses the `camera` plugin.
  - **Web: on-device** (KAN-92) — `web/mediapipe_bridge.js` (ES module, loaded from
    `index.html`) runs MediaPipe `detectForVideo` on the live `<video>`, which the vendored
    `camera_web` publishes as `window.__flutterCameraVideo` (second `LOCAL PATCH`). Dart side:
    `lib/services/platform_services*.dart` (`OnDeviceDetector`, conditional import on
    `dart.library.js_interop`); loop every 33 ms, ~20–30 FPS, nothing uploaded.
  - **Fallback / native:** every `detectIntervalMs` (350 ms) `takePicture()` → POST
    `/api/detect` (~2–3 FPS). Native on-device detection is KAN-93.
  - `state/vision_provider.dart` — `VisionProvider` (ChangeNotifier): camera
    lifecycle, detection loop, virtual "demo mode" (fake desk-scene boxes), identify, chat.
  - `services/api_service.dart` — HTTP client. Default base URL
    (`AppSettings.defaultBackendUrl`): web → page origin (nginx proxies `/api/`),
    Android emulator → `10.0.2.2:8000`, override with `--dart-define=BACKEND_URL=...`
    or the Settings dialog. Sends the selected LLM `provider` on identify/chat.
  - `services/frame_cropper.dart` — crops the tapped box out of the last frame
    (`package:image`) and sends it as `image_b64` so multimodal LLMs see the object.
  - `widgets/camera_view.dart` — error / demo / idle / live preview states + tap-to-select boxes.
  - `views/home_view.dart` — ≥850 px wide → `DesktopView`, else `MobileView`.
  - Docker image just copies a **prebuilt** `build/web` into nginx — you must run
    `flutter build web --release` locally before `docker compose up -d --build flutter-web`.

## Known issues / gotchas

1. **Camera wouldn't open on this machine (fixed 2026-09-24).** `camera_web`
   0.3.5+6's `availableCameras()` opens *every* video device to read its facing
   mode and aborts entirely if any one fails. The machine has "OBS Virtual Camera",
   which throws `NotReadableError` whenever OBS isn't running → Flutter reported
   "Camera Hardware Inaccessible" even though the webcam was fine. Fix: a patched
   copy vendored at `flutter_frontend/packages/camera_web/` (look for `LOCAL PATCH`)
   wired in via `dependency_overrides` in `pubspec.yaml` — failing devices are
   skipped. Drop the override if upstream ever fixes this. Also `_setupCamera` now
   disposes the previous controller before opening another.
2. **Stale Flutter builds in browser.** nginx cached all `.js` for 1 day, and
   `main.dart.js` isn't content-hashed, so redeploys were invisible. `nginx.conf`
   now sends `Cache-Control: no-cache` for Flutter's entry files. If a fix "doesn't
   work", check that the browser actually fetched the new `main.dart.js`.
3. **Flutter ↔ backend API contract (fixed 2026-09-24, KAN-69..73).** The Flutter
   client had been written against a different schema (sent `image`, `message`…,
   got 422s). It now follows `backend/schemas.py` exactly. `/api/detect` returns
   `image_width`/`image_height` so clients can normalize the pixel boxes
   (`DetectedObject.fromJson`). **Guarded by contract tests on both sides**:
   `tests/test_contract.py` and `flutter_frontend/test/api_contract_test.dart` —
   change a schema and one of them fails. Keep them in sync.
4. **Ollama silently falls back to offline answers** if `OLLAMA_MODEL`
   (default `gemma2:2b`) isn't pulled — responses then say
   "Offline Knowledge Engine" / "Offline Smart Assistant" in `model_used`.
   Check `curl localhost:11434/api/tags`.
5. Diagnosing camera errors: the Flutter UI maps raw errors to friendly text
   (`VisionProvider.friendlyCameraError`), hiding the real cause. In DevTools,
   probe each device with `getUserMedia({video:{deviceId:{exact:id}}})` to find the
   one that fails.

## Ports (docker compose)

backend `:8000` (Swagger `/docs`) · Next.js `:3010` · Flutter web `:3020`
(nginx proxies `/api/` → backend, but the Flutter app calls `localhost:8000` directly by default).

## Do's and Dont's
- Don't use AI slop based UI colors.
- Don't invent new features.
- Always use shadcn for flutter UI.
- Always use tailwind for nextjs ui.
- Always use uv for python package and its virtual environment.
- Always use flutter for cross platform.
