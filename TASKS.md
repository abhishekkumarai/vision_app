# TASKS — vision_app

Jira epic: **[KAN-66](https://emailabhishek2.atlassian.net/browse/KAN-66)** — Vision App v1.1: Stabilization, API Contract Alignment & Backlog
(follows the completed epics KAN-49 *MediaPipe + LLM app* and KAN-58 *Flutter client*).
Architecture orientation: [`LLM.md`](LLM.md).

Status legend: ✅ done · 🔍 in review (code done, awaiting on-screen check) · ⬜ to do

---

## ⭐ Features (what the app does today)

| Area | Feature | Where |
|---|---|---|
| Detection | MediaPipe EfficientDet-Lite0 object detection — server-side (FastAPI) and in-browser WASM/GPU (Next.js) | `backend/detector.py`, `frontend/components/CameraViewfinder.tsx` |
| Intelligence | Multi-provider LLM identify: Ollama (Gemma 2), Google Gemini (multimodal), curated offline knowledge base, generic fallback | `backend/llm_service.py` |
| Chat | Contextual Q&A about the identified object | `/api/chat` |
| Next.js UI | Cyberpunk HUD canvas, auto-lock highest-score target, crop-and-inspect, text-to-speech narration, provider selector | `frontend/` |
| Flutter UI | Cross-platform (web / Android / iOS), adaptive desktop ↔ mobile layout, tap-to-select boxes, settings dialog, camera diagnostics card, **virtual demo feed** | `flutter_frontend/` |
| Ops | Docker Compose: backend (:8000) + Next.js (:3010) + Flutter/nginx (:3020), healthchecks, cached model | `docker-compose.yml` |

---

## 🐞 Bugs

| # | Jira | Pri | Status | Bug |
|---|---|---|---|---|
| B1 | [KAN-67](https://emailabhishek2.atlassian.net/browse/KAN-67) | Highest | ✅ | Flutter camera won't open when a virtual camera (OBS) is installed — `camera_web` aborts enumeration on one bad device. Vendored patch in `flutter_frontend/packages/camera_web`. |
| B2 | [KAN-68](https://emailabhishek2.atlassian.net/browse/KAN-68) | High | ✅ | Browsers ran stale Flutter builds for 24h (nginx `expires 1d` on unhashed `main.dart.js`). |
| B3 | [KAN-69](https://emailabhishek2.atlassian.net/browse/KAN-69) | Highest | ✅ | Flutter live detection never shows boxes — `/api/detect` contract mismatch → 422. |
| B4 | [KAN-70](https://emailabhishek2.atlassian.net/browse/KAN-70) | Highest | ✅ | Flutter chat always fails — `/api/chat` contract mismatch → 422. |
| B5 | [KAN-71](https://emailabhishek2.atlassian.net/browse/KAN-71) | High | ✅ | Flutter identify card shows defaults — ObjectInsights parsed with wrong field names. |
| B6 | [KAN-72](https://emailabhishek2.atlassian.net/browse/KAN-72) | Medium | ✅ | Flutter web hardcodes `http://localhost:8000` instead of same-origin `/api` proxy. |
| B7 | [KAN-73](https://emailabhishek2.atlassian.net/browse/KAN-73) | Medium | ✅ | Flutter's selected LLM provider is never sent to the backend. |
| B8 | [KAN-74](https://emailabhishek2.atlassian.net/browse/KAN-74) | Medium | ✅ | Backend blocks the event loop (sync MediaPipe / Gemini in async handlers); detect `threshold` ignored. |
| B9 | [KAN-75](https://emailabhishek2.atlassian.net/browse/KAN-75) | Medium | ✅ | Backend chat ignores conversation history. |
| B10 | [KAN-76](https://emailabhishek2.atlassian.net/browse/KAN-76) | Medium | 🔍 | Next.js HUD labels render mirrored; click-to-lock selects the wrong (mirrored) box. |

## 🚀 Features in scope (this epic)

| # | Jira | Pri | Status | Feature |
|---|---|---|---|---|
| F1 | [KAN-77](https://emailabhishek2.atlassian.net/browse/KAN-77) | Medium | ✅ | Flutter multimodal identify — send cropped object snapshot as `image_b64`. |
| F2 | [KAN-78](https://emailabhishek2.atlassian.net/browse/KAN-78) | Medium | ✅ | Flutter rich insight card; suggested questions start a chat. |
| F3 | [KAN-79](https://emailabhishek2.atlassian.net/browse/KAN-79) | High | ✅ | API contract tests (backend pytest + Flutter parsing/request tests). |
| F4 | [KAN-80](https://emailabhishek2.atlassian.net/browse/KAN-80) | Low | ✅ | Docs: README + LLM.md cover the Flutter edition and build/deploy. |

## 📋 Backlog (not scheduled)

| # | Jira | Item |
|---|---|---|
| BL1 | [KAN-81](https://emailabhishek2.atlassian.net/browse/KAN-81) | Next.js server-side detection fallback when MediaPipe WASM/GPU fails. |
| BL2 | [KAN-82](https://emailabhishek2.atlassian.net/browse/KAN-82) | Flutter faster detection transport (WebSocket / downscaled frames / in-browser MediaPipe). |
| BL3 | [KAN-83](https://emailabhishek2.atlassian.net/browse/KAN-83) | Streaming LLM responses (SSE) for identify & chat. |
| BL4 | [KAN-84](https://emailabhishek2.atlassian.net/browse/KAN-84) | Upstream the `camera_web` fix; drop the vendored override. |
| BL5 | [KAN-85](https://emailabhishek2.atlassian.net/browse/KAN-85) | Cleanup: retire `frontend_static`, fix GPU health reporting (`torch` not installed), replace `alert()`, add CI. |
| BL6 | [KAN-86](https://emailabhishek2.atlassian.net/browse/KAN-86) | Flutter Android/iOS on-device build & camera verification. |

---

## Verification log (2026-09-24)

- Backend: `uv run pytest tests/test_app.py tests/test_contract.py` → 11 passed.
- Flutter: `flutter test` → 17 passed (models, widgets, API contract, frame cropper); `flutter analyze` → no errors/warnings.
- Next.js: `tsc --noEmit` clean.
- Live, Chrome @ localhost:3020 (webcam): detect calls go same-origin via nginx → 200, "person 88-92%" boxes drawn; tapping the detection → `/api/identify` 200 with cropped snapshot, full insight card + suggested questions; chat question → `/api/chat` 200 with answer.
- **Not yet verified on screen:** KAN-76 (Next.js mirrored HUD) — needs a foreground tab with the camera.
- **Environment note:** local Ollama only has `qwen3.5b`; backend asks for `gemma2:2b`, so LLM answers currently come from the offline fallback. `ollama pull gemma2:2b` or set `OLLAMA_MODEL`.
