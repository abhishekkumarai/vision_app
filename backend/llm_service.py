"""
Unified LLM Service supporting Ollama, Google GenAI, and offline Mock provider.
Traceability: Epic KAN-49, Task KAN-52
"""
import base64
import json
import os
import re
from typing import Optional, Dict, Any, List
import httpx

from backend.config import settings
from backend.schemas import ObjectInsights, ChatResponse

# Rich fallback knowledge base for instant offline zero-config intelligence
OFFLINE_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "cell phone": {
        "name": "Smartphone / Cellular Mobile Device",
        "category": "Consumer Electronics & Telecommunications",
        "summary": "A handheld mobile computing device integrating high-speed wireless connectivity, multi-core processing, touchscreen interfaces, and high-resolution optical cameras.",
        "primary_uses": [
            "Global telecommunication via cellular and VoIP networks",
            "Mobile computing, web browsing, and multi-app multitasking",
            "Computational digital photography, video recording, and media streaming",
            "Digital identity verification, mobile payments, and sensor telemetry"
        ],
        "materials_and_specs": [
            "Chassis: Anodized aerospace aluminum or titanium alloy with Corning Gorilla Glass",
            "Display: High-refresh OLED/AMOLED panel with capacitive multi-touch digitization",
            "Internals: SoC architecture (ARM Cortex / Apple Silicon / Snapdragon), LPDDR5 RAM, UFS/NVMe storage",
            "Battery: Lithium-ion polymer cell with fast charge power-delivery controllers"
        ],
        "safety_and_maintenance": [
            "Avoid exposure to extreme thermal environments (>45°C) to protect battery health",
            "Maintain 20%-80% state of charge cycles to maximize lithium battery lifecycle",
            "Clean with dry microfiber cloth; do not submerge in corrosive or saltwater liquids"
        ],
        "fun_facts": [
            "Modern smartphones contain millions of times more computing power than the Apollo 11 lunar guidance computer.",
            "The average user checks their phone between 80 to 150 times per day."
        ],
        "suggested_questions": [
            "How does the optical image stabilization system work?",
            "What rare earth metals are used inside the vibration motor?",
            "How has mobile processor thermal throttling evolved?"
        ]
    },
    "laptop": {
        "name": "Portable Laptop Computer",
        "category": "Computing & Workstation Hardware",
        "summary": "An integrated all-in-one portable personal computer designed for high-throughput computational workflows, typing, and mobile productivity.",
        "primary_uses": [
            "Software development, compilation, and data modeling",
            "High-resolution content creation, 3D rendering, and graphic design",
            "Enterprise communication, word processing, and browser workloads"
        ],
        "materials_and_specs": [
            "Chassis: CNC milled magnesium-aluminum alloy or carbon-fiber composite",
            "Thermal: Heatpipes, vapor chambers, and dual centrifugal blower fans",
            "I/O: Thunderbolt 4 / USB-C with Power Delivery, PCIe Gen4 NVMe SSD"
        ],
        "safety_and_maintenance": [
            "Ensure air intake grills along bottom and hinge remain unobstructed",
            "Use compressed air every 6 months to prevent dust buildup on heatsink fins",
            "Never close screen with hard objects resting on keyboard surface"
        ],
        "fun_facts": [
            "The Osborne 1, released in 1981, is considered the first true portable laptop—it weighed 24.5 pounds (11.1 kg).",
            "Modern vapor chamber heatpipes are thinner than 0.4 mm yet conduct heat 10x faster than solid copper."
        ],
        "suggested_questions": [
            "How does the vapor chamber cooling system dissipate thermal wattage?",
            "What is the difference between IPS and OLED laptop panels?",
            "How can I optimize battery cycles in Windows/Linux?"
        ]
    },
    "cup": {
        "name": "Ceramic / Glass Beverage Cup",
        "category": "Drinkware & Kitchenware",
        "summary": "A heat-tolerant vessel ergonomically sculpted for holding and consuming hot or cold liquids.",
        "primary_uses": [
            "Serving heated infusions (coffee, tea, espresso, cocoa)",
            "Thermal insulation to preserve liquid temperature while protecting hands",
            "Portioned liquid measurement and hydration"
        ],
        "materials_and_specs": [
            "Material: High-fired stoneware, porcelain, or borosilicate glass",
            "Glaze: Vitrified food-safe silicate enamel fired at 1200°C+",
            "Thermal shock resistance: Up to 150°C rapid delta (borosilicate)"
        ],
        "safety_and_maintenance": [
            "Inspect periodically for micro-fissures or glaze crazing",
            "Verify microwave safety if decorated with metallic luster or foil trim",
            "Allow ceramic to cool before washing with cold water to prevent thermal shock fractures"
        ],
        "fun_facts": [
            "Ceramic cups have been discovered dating back over 20,000 years in Jiangxi, China.",
            "The specific geometry and rim thickness of a coffee cup alters how aroma molecules contact the olfactory bulb."
        ],
        "suggested_questions": [
            "Why does the shape of a cup influence taste perception?",
            "How does vitrified ceramic prevent bacterial absorption?",
            "What makes borosilicate glass resistant to boiling water?"
        ]
    },
    "bottle": {
        "name": "Reusable Hydration Bottle / Container",
        "category": "Drinkware & Storage Vessel",
        "summary": "A leakproof, cylindrical container engineered for transporting liquids with thermal insulation and airtight sealing.",
        "primary_uses": [
            "Everyday hydration transport and temperature preservation",
            "Sports and active lifestyle fluid replenishment",
            "Reducing single-use plastic consumption"
        ],
        "materials_and_specs": [
            "Body: Food-grade 18/8 (304) stainless steel or BPA-free Eastman Tritan",
            "Insulation: Double-walled vacuum chamber with copper radiant barrier",
            "Seal: Food-grade silicone gasket with polypropylene threaded cap"
        ],
        "safety_and_maintenance": [
            "Clean lid gaskets regularly to prevent bacterial biofilm formation",
            "Avoid placing vacuum-insulated bottles in the freezer or dishwasher",
            "Do not store fermented or pressurized carbonated beverages for prolonged periods"
        ],
        "fun_facts": [
            "Vacuum insulated bottles rely on the same Dewar flask physics invented by Sir James Dewar in 1892 for cryogenic experiments.",
            "A high-grade vacuum gap leaves fewer air molecules than low Earth orbit, eliminating thermal convection."
        ],
        "suggested_questions": [
            "How does vacuum insulation stop thermal conduction and convection?",
            "How do I sterilize hard-to-reach bottle straw valves?",
            "What makes 18/8 stainless steel resistant to acidic juices?"
        ]
    },
    "mouse": {
        "name": "Optical / Laser Computer Mouse",
        "category": "Computer Peripherals & Input Devices",
        "summary": "A handheld pointing peripheral that translates 2D surface displacement into digitized cursor coordinates on a graphical user interface.",
        "primary_uses": [
            "Precision UI navigation, drafting, and graphical control",
            "High-polling-rate input for competitive gaming and 3D modeling",
            "Programmable macro automation via auxiliary tactile switches"
        ],
        "materials_and_specs": [
            "Sensor: High-framerate CMOS optical tracking engine (up to 30,000 DPI / 750 IPS)",
            "Switches: Mechanical or optical micro-switches rated for 50-90 million actuations",
            "Skates: Pure virgin-grade PTFE (Teflon) friction-reducing glides"
        ],
        "safety_and_maintenance": [
            "Maintain an ergonomic neutral wrist posture to prevent repetitive strain injury (RSI)",
            "Clean sensor lens cavity with an alcohol-dampened cotton swab",
            "Replace worn PTFE mouse skates when friction increases noticeably"
        ],
        "fun_facts": [
            "Douglas Engelbart invented the first computer mouse in 1964; it was carved out of wood and used two perpendicular wheels.",
            "Optical mouse sensors are actually tiny microscopic digital cameras capturing up to 10,000 pictures per second."
        ],
        "suggested_questions": [
            "How do optical microswitches eliminate debounce delay compared to mechanical ones?",
            "How does the optical sensor calculate velocity through surface cross-correlation?",
            "What is the optimal polling rate (1000Hz vs 4000Hz) for battery life?"
        ]
    },
    "keyboard": {
        "name": "Alphanumeric Computer Keyboard",
        "category": "Computer Peripherals & Input Devices",
        "summary": "An electro-mechanical input device with an array of spring-actuated keys for entering text, characters, and system commands.",
        "primary_uses": [
            "High-speed alphanumeric text composition and programming",
            "System navigation and hotkey command triggering",
            "Tactile typing feedback and interactive control"
        ],
        "materials_and_specs": [
            "Keycaps: Double-shot PBT or ABS plastic with laser-etched legends",
            "Switches: Linear, tactile, or clicky mechanical switches with gold-crosspoint contacts",
            "PCB: Hot-swappable matrix circuit with N-Key Rollover (NKRO) anti-ghosting diodes"
        ],
        "safety_and_maintenance": [
            "Use a wrist rest to maintain natural tendon alignment during prolonged typing sessions",
            "Dust keycaps with a soft brush and invert periodically to dislodge debris",
            "Keep liquids safely clear of switch stems and electrical traces"
        ],
        "fun_facts": [
            "The QWERTY layout was patented by Christopher Sholes in 1878 to prevent typewriter typebars from jamming.",
            "Mechanical keyboard enthusiasts tune switch acoustics using Krytox lubricants and polycarbonate switch films."
        ],
        "suggested_questions": [
            "What is the difference between Linear, Tactile, and Clicky switch stems?",
            "Why is PBT plastic more durable than ABS against fingertip shine?",
            "How does N-Key Rollover process simultaneous keystroke signals?"
        ]
    },
    "book": {
        "name": "Printed Book / Bound Codex",
        "category": "Media, Education & Literature",
        "summary": "A medium for recording information in the form of writing or images, composed of many pages bound together and protected by a cover.",
        "primary_uses": [
            "Dissemination of long-form knowledge, scholarship, and narrative storytelling",
            "Historical and cultural record preservation",
            "Focused, distraction-free intellectual stimulation and study"
        ],
        "materials_and_specs": [
            "Paper: Acid-free wood-pulp or cotton rag paper (80-120 GSM)",
            "Binding: Section-sewn Smyth binding or archival PUR glue adhesive",
            "Cover: Paperboard or buckram cloth with gold foil debossing"
        ],
        "safety_and_maintenance": [
            "Store upright in climate-controlled conditions (45-55% RH, 18-22°C)",
            "Keep away from direct ultraviolet sunlight to prevent paper yellowing and lignin degradation",
            "Handle with clean, dry hands to avoid transferring acidic skin oils"
        ],
        "fun_facts": [
            "The smell of old books (known as bibliosmia) is caused by the aromatic breakdown of cellulose and lignin into vanillin, benzaldehyde, and ethylbenzene.",
            "The world's oldest surviving complete printed book is the Diamond Sutra, printed in China in 868 AD using woodblocks."
        ],
        "suggested_questions": [
            "How does acid-free paper achieve a 500-year archival lifespan?",
            "What chemical compounds create the distinctive smell of aged books?",
            "How has Smyth-sewn book binding preserved centuries of manuscripts?"
        ]
    }
}

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
        self.gemini_key = settings.GEMINI_API_KEY
        self.gemini_model = settings.GEMINI_MODEL

    def _generate_generic_insights(self, label: str) -> ObjectInsights:
        clean_label = label.strip().title()
        return ObjectInsights(
            name=f"{clean_label}",
            category="Tracked Object",
            summary=f"A real-world instance of {clean_label} detected in the visual field. This item is commonly encountered in everyday domestic, commercial, or technological environments.",
            primary_uses=[
                f"Core functional utility associated with standard {clean_label} applications",
                "Human interaction, ergonomic handling, and task assistance",
                "Environmental or tool usage in day-to-day scenarios"
            ],
            materials_and_specs=[
                "Manufactured with durable commercial-grade composite or metal components",
                "Designed according to standard ergonomic and structural durability criteria",
                "Lightweight and optimized for functional efficiency"
            ],
            safety_and_maintenance=[
                "Keep clean and store in a dry, ventilated area",
                "Follow standard handling procedures appropriate for this class of object",
                "Inspect periodically for signs of mechanical wear or surface fatigue"
            ],
            fun_facts=[
                f"Objects in the {clean_label} category have evolved through decades of industrial design optimization.",
                "Advanced computer vision systems like MediaPipe detect these items using convolutional feature pyramids."
            ],
            suggested_questions=[
                f"What are the historical origins of {clean_label}?",
                f"What manufacturing processes are used to produce {clean_label}?",
                f"How has modern design improved the efficiency of {clean_label}?"
            ],
            model_used="Offline Knowledge Engine"
        )

    async def _query_ollama(self, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
        """Query local Ollama instance via HTTP."""
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                payload: Dict[str, Any] = {
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False
                }
                if image_b64:
                    if "," in image_b64:
                        image_b64 = image_b64.split(",", 1)[1]
                    payload["images"] = [image_b64]

                resp = await client.post(f"{self.ollama_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("response", "")
        except Exception as e:
            print(f"[LLMService] Ollama query failed: {e}")
        return None

    async def _query_gemini(self, prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
        """Query Google Gemini API via official SDK if key configured."""
        if not self.gemini_key:
            return None
        try:
            from google import genai
            client = genai.Client(api_key=self.gemini_key)
            if image_b64:
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]
                image_bytes = base64.b64decode(image_b64)
                response = client.models.generate_content(
                    model=self.gemini_model,
                    contents=[
                        genai.types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                        prompt
                    ]
                )
            else:
                response = client.models.generate_content(
                    model=self.gemini_model,
                    contents=prompt
                )
            return response.text
        except Exception as e:
            print(f"[LLMService] Gemini query failed: {e}")
        return None

    async def identify_object(
        self,
        label: str,
        score: Optional[float] = None,
        image_b64: Optional[str] = None,
        provider: Optional[str] = None
    ) -> ObjectInsights:
        """Identifies object and generates structured encyclopedic insights."""
        selected_provider = (provider or self.provider).lower()
        norm_label = label.lower().strip()

        # Prompt for LLM with strict JSON schema instructions
        prompt = (
            f"You are a cutting-edge visual intelligence assistant. An object has been visually tracked: '{label}'."
            f"\nReturn ONLY a raw valid JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "name": "Precise name and model/type",\n'
            '  "category": "Classification category",\n'
            '  "summary": "A captivating, informative 2-3 sentence overview",\n'
            '  "primary_uses": ["Use 1", "Use 2", "Use 3"],\n'
            '  "materials_and_specs": ["Spec 1", "Spec 2", "Spec 3"],\n'
            '  "safety_and_maintenance": ["Safety tip 1", "Maintenance tip 2"],\n'
            '  "fun_facts": ["Trivia 1", "Trivia 2"],\n'
            '  "suggested_questions": ["Question 1?", "Question 2?", "Question 3?"]\n'
            "}\n"
            "Do not wrap in markdown quotes if possible, return strictly valid parseable JSON."
        )

        # 1. Try Ollama if requested
        if selected_provider == "ollama":
            raw_response = await self._query_ollama(prompt, image_b64)
            if raw_response:
                parsed = self._extract_json(raw_response)
                if parsed:
                    parsed["model_used"] = f"Ollama ({self.ollama_model})"
                    return ObjectInsights(**parsed)

        # 2. Try Gemini if requested
        if selected_provider == "gemini":
            raw_response = await self._query_gemini(prompt, image_b64)
            if raw_response:
                parsed = self._extract_json(raw_response)
                if parsed:
                    parsed["model_used"] = f"Gemini ({self.gemini_model})"
                    return ObjectInsights(**parsed)

        # 3. Fallback to knowledge base or generic
        if norm_label in OFFLINE_KNOWLEDGE_BASE:
            data = OFFLINE_KNOWLEDGE_BASE[norm_label].copy()
            data["model_used"] = "Curated Knowledge Base (Offline Fast Path)"
            return ObjectInsights(**data)

        # Partial match in knowledge base
        for key, item in OFFLINE_KNOWLEDGE_BASE.items():
            if key in norm_label or norm_label in key:
                data = item.copy()
                data["model_used"] = "Curated Knowledge Base (Offline Match)"
                return ObjectInsights(**data)

        return self._generate_generic_insights(label)

    async def chat_about_object(
        self,
        object_context: Dict[str, Any],
        question: str,
        history: Optional[List[Dict[str, str]]] = None,
        provider: Optional[str] = None
    ) -> ChatResponse:
        """Answers contextual follow-up questions about the tracked object."""
        selected_provider = (provider or self.provider).lower()
        obj_name = object_context.get("name", "the tracked object")
        obj_summary = object_context.get("summary", "")
        obj_specs = ", ".join(object_context.get("materials_and_specs", []))

        prompt = (
            f"You are a helpful visual assistant answering a question about '{obj_name}'.\n"
            f"Context: {obj_summary}\n"
            f"Specs: {obj_specs}\n"
            f"User Question: {question}\n\n"
            f"Provide a clear, engaging, and accurate answer in 2-4 sentences."
        )

        # Try Ollama
        if selected_provider == "ollama":
            resp = await self._query_ollama(prompt)
            if resp:
                return ChatResponse(answer=resp.strip(), model_used=f"Ollama ({self.ollama_model})")

        # Try Gemini
        if selected_provider == "gemini":
            resp = await self._query_gemini(prompt)
            if resp:
                return ChatResponse(answer=resp.strip(), model_used=f"Gemini ({self.gemini_model})")

        # Offline fallback answer
        fallback_answer = (
            f"Regarding {obj_name}: {question}\n\n"
            f"In practical applications, this is governed by its material design and operational specifications ({obj_specs}). "
            f"For optimal results, ensure proper handling as outlined in its maintenance protocols."
        )
        return ChatResponse(
            answer=fallback_answer,
            model_used="Offline Smart Assistant"
        )

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extracts JSON object from possible markdown code fences."""
        try:
            # First try direct parse
            return json.loads(text.strip())
        except Exception:
            pass

        # Try extracting code block ```json ... ```
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass

        # Try finding first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end+1])
            except Exception:
                pass

        return None

llm_service_instance = LLMService()
