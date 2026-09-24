# Troubleshooting — vision_app

Symptom-first guide. Each entry: what you see → why → how to confirm → fix.
Related: [`LLM.md`](LLM.md) (architecture), [`TASKS.md`](TASKS.md) (Jira epic KAN-66).

---

## Summary of the 2026-09-24 incident: "camera is not able to open"

**Symptom.** Flutter web (`localhost:3020`) showed *"Camera Hardware Inaccessible — the physical
camera is busy or inaccessible"* (`NotReadableError`), even with no other app using the webcam.

**Root cause.** The camera itself was fine. The problem was a **virtual camera plus a library bug**:

- Chrome listed three video devices: *Integrated Webcam*, *OBS Virtual Camera* and *NVIDIA Broadcast*.
- *OBS Virtual Camera* throws `NotReadableError` whenever OBS isn't running.
- `camera_web` 0.3.5+6's `availableCameras()` opens **every** device to read its facing mode. It has no
  per-device error handling, so one bad device aborted the whole enumeration and the app got no cameras at all.

**Fix (KAN-67).** A patched copy of `camera_web` is vendored at `flutter_frontend/packages/camera_web`
(search for `LOCAL PATCH`) and wired in via `dependency_overrides` in `pubspec.yaml`. Devices that fail
to open are skipped, and the call only errors if *no* camera opens. `VisionProvider._setupCamera` now
also disposes the previous controller before opening a new one.

**Why it looked unfixed for a while (KAN-68).** nginx cached `main.dart.js` for 1 day. Flutter's entry
files aren't content-hashed, so the browser kept running the old build after redeploys. `nginx.conf` now
sends `Cache-Control: no-cache` for them.

**What else the investigation turned up (KAN-69…KAN-73).** Once the camera opened, the Flutter app
still couldn't detect or chat. Its API calls didn't match `backend/schemas.py`:

- detect sent `image` instead of `image_b64` → HTTP 422
- chat sent `message` instead of `question` → HTTP 422
- the identify response was parsed with the wrong field names

All three are fixed and now guarded by contract tests on both sides.

Verified live: webcam feed → "person 88–92%" box → identify card with cropped snapshot → chat answer.

---

## Camera

### "Camera Hardware Inaccessible" / `NotReadableError`
| Likely cause | Confirm | Fix |
|---|---|---|
| A virtual camera (OBS, NVIDIA Broadcast, Snap Camera…) that can't start | Browser console on the app page: probe each device (snippet below). One device fails, others are `OK`. | Already handled by the vendored `camera_web` patch. If the patch is missing, restore it or start/disable the virtual camera. |
| Another app really holds the webcam (Teams, Zoom, WhatsApp, Windows Camera) | PowerShell: look for `IN USE NOW` (snippet below) | Close that app, click **Retry Camera**. |
| Browser is running an old build | See [Stale build](#my-fix-doesnt-show-up--stale-flutter-build) | Hard refresh. |

Probe each device (run in DevTools on the page):
```js
for (const d of (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')) {
  try { const s = await navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: d.deviceId}}});
        console.log(d.label, 'OK'); s.getTracks().forEach(t => t.stop()); }
  catch (e) { console.log(d.label, e.name, e.message); }
}
```

Which Windows apps are using or have used the webcam:
```powershell
$b='HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
Get-ChildItem $b -Recurse | % { $p = Get-ItemProperty $_.PSPath
  if ($p.LastUsedTimeStart) { "{0} | stop: {1}" -f $_.PSChildName, $(if ($p.LastUsedTimeStop -eq 0) {'IN USE NOW'} else {[DateTime]::FromFileTime($p.LastUsedTimeStop)}) } }
```

### "Camera permission was not granted" / `NotAllowedError`
- Allow the camera via the lock icon in the address bar, then click **Retry Camera**.
- Also check **Windows Settings → Privacy & security → Camera**: both "Camera access" and "Let desktop apps access your camera" must be on. The registry `ConsentStore\webcam` `Value` should be `Allow`.

### Camera API missing / `TypeError` when opened from another device
`getUserMedia` only works in a **secure context**: `https://` or `http://localhost`. Opening
`http://<LAN-IP>:3020` from a phone won't expose the camera. Use HTTPS (reverse proxy or tunnel) or test on the host itself.

### Next.js (`:3010`) shows "Camera unavailable"
Same causes as above; the card shows the friendly reason plus the raw error. The Next.js client
calls `getUserMedia` directly (not `camera_web`), and on `NotReadableError` it automatically tries
the other cameras, so an idle OBS virtual camera is skipped.

---

## Detection / boxes

### Camera streams but no boxes appear (Flutter)
1. DevTools → Network → `api/detect`. If you get **422**, the client is sending the wrong shape: you're on an old build ([stale build](#my-fix-doesnt-show-up--stale-flutter-build)).
2. If requests go to `localhost:8000` instead of the page origin, that's also an old build. The current build uses the page origin via the nginx `/api/` proxy.
3. If you get 200 with `"detections": []`, nothing detectable is in frame. The model is EfficientDet-Lite0 (COCO classes). A close-up of a shirt isn't an object; a person, cup, phone or laptop is.
4. Backend: `curl localhost:8000/api/health` should show `mediapipe_ready: true`.

### Boxes are offset or the wrong size (Flutter)
Boxes arrive in pixels and are normalized with `image_width` / `image_height` from `/api/detect`. If
those fields are missing (old backend image), the boxes break. Rebuild the backend with `docker compose up -d --build backend`.

### Next.js shows "0.x fps" or detection seems frozen
In-browser detection runs on `requestAnimationFrame`, which browsers pause in background or
hidden tabs (automation tabs included). Bring the tab to the foreground. If Settings → Detection
engine says *Server-side*, in-browser MediaPipe failed to load (CDN blocked / no WebGL) and frames
are sent to `/api/detect` every *Server detection interval* instead.

---

## LLM answers

### Answers say "Offline Knowledge Engine" / "Offline Smart Assistant"
The backend fell back because the selected provider failed:
- **Ollama:** the model named in `OLLAMA_MODEL` (default `gemma2:2b`) isn't pulled. Check with
  `curl localhost:11434/api/tags`. As of 2026-09-24 this machine only had `qwen3.5b`.
  Fix: `ollama pull gemma2:2b`, or set `OLLAMA_MODEL=qwen3.5b` in `.env` and `docker compose up -d backend`.
- **Ollama unreachable from Docker:** the backend uses `http://host.docker.internal:11434`, so Ollama must listen on the host.
- **Gemini:** `GEMINI_API_KEY` is empty. `GET /api/providers` → `has_gemini_key`.
- Backend logs show the reason: `docker logs vision-backend | findstr LLMService`.

### Chat returns 422 / "Error communicating with intelligence server"
The client and backend are out of sync on the chat contract (`{object_context, question, history, provider}`).
Run the contract tests:
```powershell
uv run pytest tests/test_contract.py -v
cd flutter_frontend; flutter test test/api_contract_test.dart
```

---

## Events & workflows

### No events reach `/api/events`
- Settings → **Send workflow events** must be on (both clients).
- An object must stay in view ≥ 0.7 s, and each label fires at most once per 30 s per device —
  a steady scene produces no new events. Check `curl localhost:8000/api/events?limit=5`.
- A second event within 30 s from the same `client_id` is stored with status `deduplicated`
  and runs no workflow — that's expected.

### Event is `failed`
`GET /api/events/{id}` → `runs[].error` has the exception. Workflows fail independently; LLM
provider problems usually still *succeed* via the offline fallback (see `model_used`).

### Flutter web still shows ~2–3 FPS (server detection)
Settings → *Detection engine* should say **MediaPipe (in-browser)**. If it says *Server*:
the bridge didn't load (`window.visionBridge` undefined → stale cache or CDN blocked; check
DevTools console for `[visionBridge]`), or the camera `<video>` isn't published
(`window.__flutterCameraVideo` undefined → the vendored `camera_web` patch is missing; run
`flutter pub get` and rebuild).

## Deploy / build

### My fix doesn't show up — stale Flutter build
- The Flutter Docker image **copies the prebuilt `build/web`**. Rebuild both:
  ```powershell
  cd flutter_frontend; flutter build web --release; cd ..
  docker compose up -d --build flutter-web
  ```
- In the browser, confirm the page loaded the new `main.dart.js`: DevTools → Network → transfer size > 0,
  not "(memory/disk cache)". Hard refresh with **Ctrl+Shift+R**.
- Check the headers: `curl -sI localhost:3020/main.dart.js` should include `Cache-Control: no-cache`.
  Copies cached before this fix may persist for up to a day; one hard refresh clears them.

### `flutter run -d chrome` can't reach the backend
There's no nginx proxy in dev. Pass the backend explicitly:
`flutter run -d chrome --dart-define=BACKEND_URL=http://localhost:8000`

### Backend works directly but not through `:3010` / `:3020`
- `:3010` (Next.js) proxies through `app/api/[...path]/route.ts` using `BACKEND_URL=http://backend:8000`.
- `:3020` (nginx) proxies through `location /api/` in `flutter_frontend/nginx.conf`.
- Both need the `vision-backend` container to be healthy: `docker ps --filter name=vision`.

---

## Quick health checklist
```powershell
docker ps --filter name=vision                       # 3 containers up, backend (healthy)
curl localhost:8000/api/health                       # mediapipe_ready: true
curl localhost:8000/api/providers                    # current provider, has_gemini_key
curl localhost:11434/api/tags                        # Ollama models (must include OLLAMA_MODEL)
curl -sI localhost:3020/main.dart.js                 # Cache-Control: no-cache
uv run pytest tests/test_app.py tests/test_contract.py
cd flutter_frontend; flutter test
```
