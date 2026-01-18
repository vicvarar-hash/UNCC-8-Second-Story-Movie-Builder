
import { GoogleGenAI, Type } from "@google/genai";
import { Shot, AnnotatedImage } from "../types";

/**
 * Robust API key resolution for both AI Studio and standalone Production environments.
 */
export const getCurrentApiKey = (): string => {
  const aistudio = (window as any).aistudio;
  
  // 1. Check if running inside AI Studio with a selected key
  if (aistudio?.hasSelectedApiKey?.()) {
    // In AI Studio, the platform injects the key into process.env.API_KEY
    return process.env.API_KEY || '';
  }

  // 2. Fallback to localStorage for standalone Cloud Run/Production deployments
  const storedKey = localStorage.getItem("GEMINI_API_KEY");
  if (storedKey && storedKey.length > 10) {
    return storedKey;
  }

  throw new Error("No API key found. Please set your Gemini API key in Settings.");
};

const SHOT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, description: "Detailed action description." },
    camera: { type: Type.STRING, description: "Lens and movement." },
    mood: { type: Type.STRING, description: "Lighting and color." },
    audio: { type: Type.STRING, description: "Sound Design. Describe how it TRANSITIONS from the previous shot's audio." },
    dialogue: { type: Type.STRING, description: "Dialogue or 'None'." },
    visual_prompt: { type: Type.STRING, description: "Self-contained Veo 3 prompt." },
    reasoning: { type: Type.STRING, description: "Narrative flow reasoning." }
  },
  required: ["action", "camera", "mood", "audio", "dialogue", "visual_prompt", "reasoning"],
};

const parseDataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new Error("Invalid data URL");
  return { mimeType: matches[1], imageBytes: matches[2] };
};

const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 5000): Promise<T> => {
  try { return await fn(); } catch (error: any) {
    const isRateLimit = error.status === 429 || error.code === 429 || (error.message && error.message.includes('429'));
    if (isRateLimit && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateShotDetails = async (outline: string, style: string, audioStyle: string, shotNumber: number, previousShots: Shot[]): Promise<any> => {
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const historyContext = previousShots.map(s => `Shot ${s.id}: ${s.description}. Audio: ${s.audio}`).join("\n");

  const prompt = `
    Director of Photography & Sound Designer Persona.
    Outline: "${outline}" | Visual Style: "${style}" | Audio Style: "${audioStyle}"
    Shot #${shotNumber} Planning.
    
    Context:
    ${historyContext || "Opening shot."}
    
    CRITICAL AUDIO RULE: You must describe how the audio FLOWS from the previous shot. 
    Include ambient matching (same wind noise, same mechanical hum).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: SHOT_SCHEMA, thinkingConfig: { thinkingBudget: 2048 } },
  });

  return JSON.parse(response.text || "{}");
};

export const generateVideo = async (prompt: string, audioPrompt: string, startFrame?: string, referenceImages: AnnotatedImage[] = []): Promise<string> => {
  let apiKey = getCurrentApiKey();
  let ai = new GoogleGenAI({ apiKey });
  
  let model = startFrame ? "veo-3.1-fast-generate-preview" : "veo-3.1-generate-preview";
  let finalPrompt = `${prompt} \n\nAUDIO SYNC: ${audioPrompt}`;

  try {
    const requestPayload: any = {
      model,
      prompt: finalPrompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    };

    if (startFrame) {
      const { mimeType, imageBytes } = parseDataUrl(startFrame);
      requestPayload.image = { imageBytes, mimeType };
    } else if (referenceImages.length > 0) {
      requestPayload.config.referenceImages = referenceImages.map(img => {
        const { mimeType, imageBytes } = parseDataUrl(img.url);
        return { image: { imageBytes, mimeType }, referenceType: 'ASSET' };
      });
    }

    let operation: any = await retryWithBackoff(() => ai.models.generateVideos(requestPayload));

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await retryWithBackoff(() => ai.operations.getVideosOperation({ operation }));
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned.");

    apiKey = getCurrentApiKey();
    const url = new URL(videoUri);
    url.searchParams.set('key', apiKey);
    const downloadUrl = url.toString();
    
    const response = await fetch(downloadUrl, { method: 'GET', mode: 'cors' });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 && errorText.includes("API key not valid")) {
        throw new Error("REAUTH_REQUIRED: Invalid API key.");
      }
      throw new Error(`Failed to download: ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
  } catch (error) { 
    console.error("[Veo] Error:", error);
    throw error; 
  }
};
