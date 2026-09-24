"""
MediaPipe Object Detection Task wrapper.
Traceability: Epic KAN-49, Task KAN-51
"""
import base64
import io
import time
from typing import List, Tuple
from pathlib import Path
import numpy as np
from PIL import Image

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from backend.config import settings
from backend.models.download_models import ensure_model_downloaded
from backend.schemas import BoundingBox, DetectionItem

# (detections, processing_time_ms, (image_width, image_height)); boxes are in pixels.
DetectionResult = Tuple[List[DetectionItem], float, Tuple[int, int]]

class MediaPipeDetector:
    def __init__(self, model_path: str = None, threshold: float = None, max_results: int = None):
        self.model_path = model_path or settings.MEDIAPIPE_MODEL_PATH
        self.threshold = threshold or settings.DETECTION_THRESHOLD
        self.max_results = max_results or settings.MAX_DETECTIONS
        self.detector = None
        self._initialize_detector()

    def _initialize_detector(self):
        try:
            model_file = ensure_model_downloaded()
            base_options = python.BaseOptions(model_asset_path=str(model_file))
            options = vision.ObjectDetectorOptions(
                base_options=base_options,
                score_threshold=self.threshold,
                max_results=self.max_results
            )
            self.detector = vision.ObjectDetector.create_from_options(options)
            print(f"[MediaPipeDetector] Successfully initialized with {model_file.name}")
        except Exception as e:
            print(f"[MediaPipeDetector] Error initializing MediaPipe ObjectDetector: {e}")
            self.detector = None

    def is_ready(self) -> bool:
        return self.detector is not None

    def detect_image(self, pil_image: Image.Image) -> DetectionResult:
        """Detect objects in a PIL Image. Returns (detections, ms, (width, height)); boxes are in pixels."""
        if not self.is_ready():
            return [], 0.0, pil_image.size

        start_time = time.perf_counter()
        
        # Convert PIL to RGB numpy array
        rgb_image = pil_image.convert("RGB")
        np_image = np.array(rgb_image)
        
        # Create MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_image)
        
        # Run detection
        detection_result = self.detector.detect(mp_image)
        processing_time = (time.perf_counter() - start_time) * 1000.0

        detections: List[DetectionItem] = []
        for detection in detection_result.detections:
            if not detection.categories:
                continue
            category = detection.categories[0]
            bbox = detection.bounding_box
            
            detections.append(
                DetectionItem(
                    label=category.category_name or "object",
                    score=float(category.score),
                    bounding_box=BoundingBox(
                        origin_x=float(bbox.origin_x),
                        origin_y=float(bbox.origin_y),
                        width=float(bbox.width),
                        height=float(bbox.height)
                    )
                )
            )

        return detections, processing_time, pil_image.size

    def detect_from_bytes(self, image_bytes: bytes) -> DetectionResult:
        pil_image = Image.open(io.BytesIO(image_bytes))
        return self.detect_image(pil_image)

    def detect_from_b64(self, b64_str: str) -> DetectionResult:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        image_bytes = base64.b64decode(b64_str)
        return self.detect_from_bytes(image_bytes)

# Global singleton detector
detector_instance = MediaPipeDetector()
