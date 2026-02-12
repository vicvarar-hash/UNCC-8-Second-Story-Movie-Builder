
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

/** Trust gate: fail fast before any AI call. Throws if API key is missing or invalid. */
function validateApiKey(): void {
  const key = getCurrentApiKey();
  if (!key || key.length < 10) {
    throw new Error(
      "API key is required. Set GEMINI_API_KEY in localStorage or use the key selector in the app header."
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
  context: { story: string; constraints: string; plan?: string }
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
    3. Continuity: Are characters and environments consistent across frames?
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

  const parts = frames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f } }));
  parts.push({ text: prompt } as any);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: parts as any },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: RUBRIC_SCHEMA 
    },
  });

  return JSON.parse(response.text || '{}');
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

export const generateProjectPlan = async (outline: string, style: string, numShots: number): Promise<ShotPlan[]> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Create a detailed shot-by-shot movie plan for an 8-second story builder.
    Story: ${outline}
    Style: ${style}
    Target Shots: ${numShots}
    
    Each shot is exactly 8 seconds. 
    You MUST provide detailed movie production controls for each shot including camera settings, sound design, and continuity locks.
    Ensure strict adherence to JSON schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: PLAN_SCHEMA,
      thinkingConfig: { thinkingBudget: 4096 }
    },
  });

  const parsed = JSON.parse(response.text || '{"shots":[]}');
  return parsed.shots;
};

export const suggestNextShotPlan = async (outline: string, style: string, previousShots: Shot[]): Promise<ShotPlan> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const context = previousShots.map(s => `Shot ${s.index + 1}: ${s.plan.narrativeIntent}. Action: ${s.plan.action}`).join("\n");
  
  const prompt = `
    Suggest exactly ONE new 8-second ShotPlan that naturally continues the story.
    Global Intent: ${outline}
    Style constraints: ${style}
    Context: ${context}
    Output strict JSON matching the full ShotPlan production schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: SINGLE_PLAN_SCHEMA,
      thinkingConfig: { thinkingBudget: 2048 }
    },
  });

  return JSON.parse(response.text || '{}');
};

export const generateVideoAttempt = async (
  shotPlan: ShotPlan, 
  options: { useSeed: boolean, useRefImage: boolean, requestExplanation: boolean },
  previousVideoUrl?: string
): Promise<Partial<GenerationAttempt>> => {
  validateApiKey();
  const apiKey = getCurrentApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const model = "veo-3.1-generate-preview";
  let finalPrompt = shotPlan.videoPrompt;
  
  if (options.requestExplanation) {
    finalPrompt += "\n\nProvide a technical explanation of your design choices and a self-assigned confidence level (Low/Medium/High).";
  }

  try {
    const requestPayload: any = {
      model,
      prompt: finalPrompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    };

    let operation: any = await ai.models.generateVideos(requestPayload);
    while (!operation.done) {
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
