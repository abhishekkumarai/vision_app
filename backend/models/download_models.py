"""
MediaPipe Object Detector Model Downloader.
Downloads official efficientdet_lite0.tflite model if not present.
Traceability: Epic KAN-49, Task KAN-51
"""
import os
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent
MODEL_FILE = MODEL_DIR / "efficientdet_lite0.tflite"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite"

def ensure_model_downloaded() -> Path:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if not MODEL_FILE.exists() or MODEL_FILE.stat().st_size == 0:
        print(f"Downloading EfficientDet-Lite0 model from {MODEL_URL}...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_FILE)
            print(f"Model saved to {MODEL_FILE} ({MODEL_FILE.stat().st_size / 1024 / 1024:.2f} MB)")
        except Exception as e:
            print(f"Failed to download model from Google storage: {e}")
            raise
    else:
        print(f"Model already exists at {MODEL_FILE}")
    return MODEL_FILE

if __name__ == "__main__":
    ensure_model_downloaded()
