/**
 * Text-to-Speech Assistant using Web Speech API
 * Traceability: Epic KAN-49, Task KAN-53
 */

class SpeechAssistant {
  constructor() {
    this.synth = window.speechSynthesis;
    this.speaking = false;
    this.voice = null;
    this._loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this._loadVoices();
    }
  }

  _loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prioritize natural Google or Microsoft English voices
    this.voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) ||
                 voices.find(v => v.lang.startsWith('en')) ||
                 voices[0];
  }

  speak(text, onEndCallback = null) {
    if (!this.synth) return;
    this.stop();

    if (!text || text.trim() === '') return;

    // Clean markdown symbols or asterisks before speaking
    const cleanText = text.replace(/[*_#`~]/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.speaking = true;
    };

    utterance.onend = () => {
      this.speaking = false;
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
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

  isSpeaking() {
    return this.speaking;
  }
}

window.speechAssistant = new SpeechAssistant();
