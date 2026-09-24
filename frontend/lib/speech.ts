/**
 * Web Speech API Text-to-Speech Assistant
 * Traceability: Epic KAN-49, Task KAN-55
 */

class SpeechAssistant {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private speaking: boolean = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    this.voice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel"))
      ) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0] ||
      null;
  }

  speak(text: string, onEndCallback?: () => void) {
    if (!this.synth) return;
    this.stop();

    if (!text || text.trim() === "") return;

    const cleanText = text.replace(/[*_#`~]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.rate = 1.05;

    utterance.onstart = () => {
      this.speaking = true;
    };

    utterance.onend = () => {
      this.speaking = false;
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn("Speech error:", e);
      this.speaking = false;
      if (onEndCallback) onEndCallback();
    };

    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

export const speechAssistant = new SpeechAssistant();
