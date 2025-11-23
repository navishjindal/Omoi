import { GoogleGenAI, Modality } from "@google/genai";
import { VOCABULARY } from "../constants";
import { AACSymbol } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Flatten vocabulary for searching and context
 */
const flattenVocabulary = (items: AACSymbol[]): any[] => {
  let flat: any[] = [];
  items.forEach(item => {
    flat.push({ id: item.id, label: item.label, keywords: item.keywords });
    if (item.children) {
      flat = [...flat, ...flattenVocabulary(item.children)];
    }
  });
  return flat;
};

const flatVocab = flattenVocabulary(VOCABULARY);

/**
 * Helper to convert Blob to Base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Takes a sequence of symbols AND optional audio context to make a natural sentence.
 * Uses Gemini 2.5's multimodal capabilities to "hear" the user's intent.
 */
export const naturalizeSentence = async (symbols: string[], audioBlob?: Blob | null): Promise<string> => {
  if (symbols.length === 0 && !audioBlob) return "";

  const model = 'gemini-2.5-flash';

  const promptText = `
    You are an AAC communication assistant. The user has selected these symbols in order: ${symbols.join(', ')}
    
    Your task:
    1. Reorder and combine these words into a grammatically correct, natural sentence
    2. The user may have selected words in ANY order - you must rearrange them to make sense
    3. If audio is provided, use it to detect emotion (excited, frustrated, calm, urgent) and tone
    4. Speak as a child would naturally speak
    5. Add necessary words (I, want, need, please, help, etc.) to make it sound natural
    
    Examples:
    - Input: "help, poop, dad" → Output: "Dad, I need help going to the bathroom!"
    - Input: "pizza, want, now" → Output: "I want pizza right now!"
    - Input: "play, outside, want" → Output: "I want to play outside!"
    - Input: "bathroom, need" → Output: "I need to use the bathroom."
    
    Return ONLY the natural sentence, nothing else.
  `;

  const parts: any[] = [{ text: promptText }];

  if (audioBlob) {
    try {
      const base64Audio = await blobToBase64(audioBlob);
      parts.push({
        inlineData: {
          mimeType: audioBlob.type || 'audio/webm',
          data: base64Audio
        }
      });
    } catch (e) {
      console.warn("Failed to process audio blob for API, proceeding with text only.", e);
    }
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
    });
    return response.text?.trim() || symbols.join(' ');
  } catch (error) {
    console.error("Gemini naturalization error:", error);
    return symbols.join(' ');
  }
};

/**
 * Predicts the next likely AAC symbols based on the current sentence history.
 */
export const predictNextSymbols = async (currentLabels: string[]): Promise<string[]> => {
  if (currentLabels.length === 0) return [];

  // Create a lightweight context string of available vocabulary options
  // Format: "id: label"
  const vocabContext = flatVocab.map(v => `${v.id}: ${v.label}`).join(', ');

  const model = 'gemini-2.5-flash';
  const prompt = `
    AAC Prediction Task:
    Current: [${currentLabels.join(', ')}]
    Vocabulary: ${vocabContext}
    
    Return JSON array of 3 most likely next symbol IDs.
    Example: ["want", "apple", "play"]
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = response.text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Gemini prediction error:", error);
    return [];
  }
};

/**
 * Generates high-quality speech from text using ElevenLabs TTS.
 * Falls back to Gemini TTS if ElevenLabs fails.
 */
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  if (!text) return null;

  // Try ElevenLabs first (faster and higher quality)
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (ELEVENLABS_API_KEY) {
      // Using Rachel voice - warm, clear, and child-friendly
      const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Rachel voice

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5', // Fastest model with great quality
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        return await audioBlob.arrayBuffer();
      } else {
        console.warn("ElevenLabs TTS failed, falling back to Gemini:", await response.text());
      }
    }
  } catch (error) {
    console.warn("ElevenLabs TTS error, falling back to Gemini:", error);
  }

  // Fallback to Gemini TTS
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return null;
  } catch (error) {
    console.error("Both ElevenLabs and Gemini TTS failed:", error);
    return null;
  }
};

/**
 * Helper to decode audio for playback
 */
export const playAudioBuffer = async (buffer: ArrayBuffer) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
};