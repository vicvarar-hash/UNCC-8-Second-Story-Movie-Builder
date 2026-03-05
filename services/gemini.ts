import { GoogleGenAI, Type } from "@google/genai";
import { Shot, ShotPlan, GenerationAttempt, SelfReviewRubric } from "../types";

export const getCurrentApiKey = (): string => {
  const aistudio = (window as any).aistudio;
  if (aistudio?.hasSelectedApiKey?.()) {
    return process.env.API_KEY || '';
  }
  const storedKey = localStorage.getItem("GEMINI_API_KEY");
  if (storedKey && storedKey.length > 10) {
    return storedKey;
  }
  return process.env.API_KEY || '';
};

/** Pure validation logic: throws if key is missing or too short. Testable without browser mocks. */
export function validateApiKeyLogic(key: string): void {
  if (!key || key.length < 10) {
    throw new Error(
      "API key is required. Set GEMINI_API_KEY in localStorage or use the key selector in the app header."
    );
  }
}

/** Max wait for Veo video generation (5 min). Prevents indefinite hangs (TR7). */
const VIDEO_GENERATION_MAX_WAIT_MS = 5 * 60 * 1000;

/** Thrown when Veo polling exceeds max wait. Surface to UI (TR7). */
export class VideoGenerationTimeoutError extends Error {
  constructor(message: string = "TimeoutError: Video generation timed out after 5 minutes.") {
    super(message);
    this.name = "VideoGenerationTimeoutError";
  }
}

/** Trust gate: fail fast before any AI call. Throws if API key is missing or invalid. */
function validateApiKey(): void {
  const key = getCurrentApiKey();
  validateApiKeyLogic(key);
}

/** Safe JSON parse: throws with clear message on parse failure. Never returns empty object silently. */
function safeParseJson<T>(raw: string, fallback: string, context: string): T {
  const text = raw?.trim() || fallback;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `AI response parse error (${context}): ${msg}. Raw preview: ${text.slice(0, 200)}...`
    );
  }
}

const RUBRIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrativeConsistency: {
      type: Type.OBJECT,
      properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
      required: ["score", "reasoning"]
    },
    visualFidelity: {
      type: Type.OBJECT,
      properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
      required: ["score", "reasoning"]
    },
    continuity: {
      type: Type.OBJECT,
      properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
      required: ["score", "reasoning"]
    },
    physicsAndLogic: {
      type: Type.OBJECT,
      properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
      required: ["score", "reasoning"]
    },
    overallConfidence: { type: Type.STRING, description: "Low, Medium, or High" },
    summary: { type: Type.STRING },
    promptRevision: {
      type: Type.OBJECT,
      properties: {
        revisedVideoPrompt: { type: Type.STRING },
        changes: { type: Type.ARRAY, items: { type: Type.STRING } },
        regenerationHints: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["revisedVideoPrompt", "changes", "regenerationHints"]
    }
  },
  required: ["narrativeConsistency", "visualFidelity", "continuity", "physicsAndLogic", "overallConfidence", "summary", "promptRevision"]
};

export const sampleFrames = async (videoSrc: string | File, count: number = 3): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];

    video.crossOrigin = "anonymous";
    video.muted = true;
    
    if (typeof videoSrc === 'string') {
      video.src = videoSrc;
    } else {
      video.src = URL.createObjectURL(videoSrc);
    }

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1);
      
      for (let i = 1; i <= count; i++) {
        video.currentTime = interval * i;
        await new Promise(r => { video.onseeked = r; });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      }
      resolve(frames);
    };

    video.onerror = () => reject(new Error("Failed to load video for sampling."));
  });
};

export const runAISelfReview = async (
  frames: string[], 
  context: { 
    story: string; 
    constraints: string; 
    plan?: string;
    referenceImages?: { url: string; label: string }[]
  }
): Promise<SelfReviewRubric> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze the provided video frames from an AI-generated movie.
    
    Context:
    Global Story Intent: ${context.story}
    Visual Constraints: ${context.constraints}
    ${context.plan ? `Shot Plan: ${context.plan}` : ''}

    Evaluate based on the following rubric:
    1. Narrative Consistency: Does the action match the intent?
    2. Visual Fidelity: Does it adhere to the specified style?
    3. Continuity: Are characters and environments consistent across frames and with any provided reference images?
    4. Physics and Logic: Any obvious hallucinations or physics violations?

    IMPORTANT: Suggest a Revised Video Prompt.
    - Base revisions strictly on the observed failures in the video frames.
    - Preserve original story intent and style constraints.
    - Avoid adding new story elements unless required to fix a specific failure.
    - Provide a list of specific changes made and regeneration hints.

    Assign a score from 1 to 5 for each category and provide reasoning.
    Also assign an overall confidence level (Low, Medium, High).
    Be critical. AI self-review should identify failures to assist evaluation.
  `;

  const parts: any[] = frames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f } }));
  
  if (context.referenceImages) {
    for (const img of context.referenceImages) {
      if (img.url.startsWith('data:')) {
        const [mime, data] = img.url.split(';base64,');
        parts.push({
          inlineData: {
            mimeType: mime.split(':')[1],
            data: data
          }
        });
      }
    }
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: parts as any },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: RUBRIC_SCHEMA 
    },
  });

  return safeParseJson<SelfReviewRubric>(response.text ?? "", "{}", "runAISelfReview");
};

const PLAN_ITEM_PROPS = {
  narrativeIntent: { type: Type.STRING },
  shotType: { type: Type.STRING },
  cameraMovement: { type: Type.STRING },
  cameraAngle: { type: Type.STRING },
  lens: { type: Type.STRING },
  framingSubject: { type: Type.STRING },
  compositionNotes: { type: Type.STRING },
  colorPalette: { type: Type.STRING },
  vfxNotes: { type: Type.STRING },
  soundBed: { type: Type.STRING },
  musicCue: { type: Type.STRING },
  sfx: { type: Type.ARRAY, items: { type: Type.STRING } },
  dialogueStyle: { type: Type.STRING },
  continuityLocks: { type: Type.ARRAY, items: { type: Type.STRING } },
  keyProps: { type: Type.ARRAY, items: { type: Type.STRING } },
  characterState: { type: Type.STRING },
  mustInclude: { type: Type.ARRAY, items: { type: Type.STRING } },
  mustAvoid: { type: Type.ARRAY, items: { type: Type.STRING } },
  assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
  action: { type: Type.STRING },
  camera: { type: Type.STRING },
  mood: { type: Type.STRING },
  audioIntent: { type: Type.STRING },
  dialogue: { type: Type.STRING },
  videoPrompt: { type: Type.STRING },
};

const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: PLAN_ITEM_PROPS,
        required: [
          "narrativeIntent", "shotType", "cameraMovement", "cameraAngle", "lens", 
          "framingSubject", "compositionNotes", "colorPalette", "vfxNotes",
          "soundBed", "musicCue", "sfx", "dialogueStyle", "continuityLocks",
          "keyProps", "characterState", "mustInclude", "mustAvoid",
          "assumptions", "action", "camera", "mood", "audioIntent", "dialogue", "videoPrompt"
        ]
      }
    }
  },
  required: ["shots"]
};

const SINGLE_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: PLAN_ITEM_PROPS,
  required: Object.keys(PLAN_ITEM_PROPS)
};

export const generateProjectPlan = async (
  outline: string, 
  style: string, 
  audioIntent: string,
  contentConstraints: string,
  referenceImages: { url: string; label: string }[],
  numShots: number
): Promise<ShotPlan[]> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Create a detailed shot-by-shot movie plan for an 8-second story builder.
    Story: ${outline}
    Style: ${style}
    Audio Intent: ${audioIntent}
    Content Constraints: ${contentConstraints}
    Target Shots: ${numShots}
    
    Each shot is exactly 8 seconds. 
    You MUST provide detailed movie production controls for each shot including camera settings, sound design, and continuity locks.
    Ensure strict adherence to JSON schema.
  `;

  const parts: any[] = [{ text: prompt }];
  
  for (const img of referenceImages) {
    if (img.url.startsWith('data:')) {
      const [mime, data] = img.url.split(';base64,');
      parts.push({
        inlineData: {
          mimeType: mime.split(':')[1],
          data: data
        }
      });
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: PLAN_SCHEMA,
      thinkingConfig: { thinkingBudget: 4096 }
    },
  });
  const parsed = safeParseJson<{ shots: ShotPlan[] }>(
    response.text ?? "",
    '{"shots":[]}',
    "generateProjectPlan"
  );
  return parsed.shots;
};

export const suggestNextShotPlan = async (
  outline: string, 
  style: string, 
  audioIntent: string,
  contentConstraints: string,
  referenceImages: { url: string; label: string }[],
  previousShots: Shot[]
): Promise<ShotPlan> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const context = previousShots.map(s => `Shot ${s.index + 1}: ${s.plan.narrativeIntent}. Action: ${s.plan.action}`).join("\n");
  
  const prompt = `
    Suggest exactly ONE new 8-second ShotPlan that naturally continues the story.
    Global Intent: ${outline}
    Style constraints: ${style}
    Audio Intent: ${audioIntent}
    Content Constraints: ${contentConstraints}
    Context: ${context}
    Output strict JSON matching the full ShotPlan production schema.
  `;

  const parts: any[] = [{ text: prompt }];
  
  for (const img of referenceImages) {
    if (img.url.startsWith('data:')) {
      const [mime, data] = img.url.split(';base64,');
      parts.push({
        inlineData: {
          mimeType: mime.split(':')[1],
          data: data
        }
      });
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: SINGLE_PLAN_SCHEMA,
      thinkingConfig: { thinkingBudget: 2048 }
    },
  });

  return safeParseJson<ShotPlan>(response.text ?? "", "{}", "suggestNextShotPlan");
};

export const generateVideoAttempt = async (
  shotPlan: ShotPlan, 
  options: { useSeed: boolean, useRefImage: boolean, requestExplanation: boolean },
  referenceImages: { url: string; label: string }[] = []
): Promise<Partial<GenerationAttempt>> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const model = "veo-3.1-generate-preview";
  
  // Enhance prompt with shot plan specifics if not already present
  let finalPrompt = shotPlan.videoPrompt;
  
  // Explicitly add constraints and audio mood to the prompt to ensure Veo follows them
  if (shotPlan.mustInclude?.length > 0) {
    finalPrompt += `\nMust include: ${shotPlan.mustInclude.join(", ")}.`;
  }
  if (shotPlan.mustAvoid?.length > 0) {
    finalPrompt += `\nMust avoid: ${shotPlan.mustAvoid.join(", ")}.`;
  }
  if (shotPlan.mood) {
    finalPrompt += `\nMood: ${shotPlan.mood}.`;
  }
  if (shotPlan.audioIntent) {
    finalPrompt += `\nVisual pacing should match audio intent: ${shotPlan.audioIntent}.`;
  }
  
  if (options.requestExplanation) {
    finalPrompt += "\n\nProvide a technical explanation of your design choices and a self-assigned confidence level (Low/Medium/High).";
  }

  try {
    const referenceImagesPayload: any[] = [];
    
    // Veo supports up to 3 reference images
    const imagesToUse = referenceImages.slice(0, 3);
    
    for (const img of imagesToUse) {
      if (img.url.startsWith('data:')) {
        const [mimePart, data] = img.url.split(';base64,');
        const mimeType = mimePart.split(':')[1];
        referenceImagesPayload.push({
          image: {
            imageBytes: data,
            mimeType: mimeType,
          },
          referenceType: "ASSET",
        });
      }
    }

    const requestPayload: any = {
      model,
      prompt: finalPrompt,
      config: { 
        numberOfVideos: 1, 
        resolution: '720p', 
        aspectRatio: '16:9',
        referenceImages: referenceImagesPayload.length > 0 ? referenceImagesPayload : undefined
      }
    };

    let operation: any = await ai.models.generateVideos(requestPayload);
    const deadline = Date.now() + VIDEO_GENERATION_MAX_WAIT_MS;
    while (!operation.done) {
      if (Date.now() > deadline) {
        throw new VideoGenerationTimeoutError(
          `Video generation timed out after ${VIDEO_GENERATION_MAX_WAIT_MS / 1000}s.`
        );
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned.");

    const downloadUrl = `${videoUri}&key=${apiKey}`;
    const response = await fetch(downloadUrl, { method: 'GET', mode: 'cors' });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const blob = await response.blob();
    return {
      videoUrl: URL.createObjectURL(new Blob([blob], { type: 'video/mp4' })),
      prompt: finalPrompt,
      modelInfo: model,
      metadata: { useSeed: options.useSeed, useRefImage: options.useRefImage }
    };
  } catch (error: any) {
    console.error("[Veo] Attempt failed:", error);
    return {
      error: error.message || "Generation failed",
      prompt: finalPrompt,
      modelInfo: model,
      metadata: { useSeed: options.useSeed, useRefImage: options.useRefImage }
    };
  }
};