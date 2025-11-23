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
    Task: Interpret the user's intent based on the selected AAC symbols AND their vocalization (audio).
    
    Selected Symbols: ${symbols.join(', ')}
    
    Instructions:
    1. Listen to the audio (if provided) to detect tone, emotion, or attempted words (like "I want", "No", "Please").
    2. If the audio is unclear or silence, rely on the symbols.
    3. Combine the symbols into a natural, polite English sentence spoken by a child.
    4. Example: If Audio is "uhh waaa" (sounds like want) and Symbol is "Pizza", output "I really want some pizza."
    5. Example: If Symbol is "Bathroom", output "I need to go to the bathroom."
    
    Return ONLY the sentence string.
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
    You are an AAC (Augmentative and Alternative Communication) predictive engine.
    
    Current Sentence Context: [${currentLabels.join(', ')}]
    
    Available Vocabulary Options (ID: Label):
    ${vocabContext}
    
    Task:
    Predict the ID of the next 3 most likely symbols the user will want to select to complete their thought.
    
    Rules:
    1. Return ONLY a JSON array of strings (the IDs).
    2. Do not include any markdown or explanation.
    3. Example output: ["want", "apple", "play"]
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
 * Generates high-quality speech from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  if (!text) return null;

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
    console.error("Gemini TTS error:", error);
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