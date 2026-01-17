
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Shot, AnnotatedImage } from "../types";

// Helper to get AI client - MUST be called just before use to ensure latest API key
const getAiClient = () => {
  // The API key is injected by the environment after selection
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const SHOT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, description: "Detailed description of the action occurring in the 8s shot. Focus on movement and pacing." },
    camera: { type: Type.STRING, description: "Precise cinematic direction. Specify lens choice (e.g., 24mm, 85mm), camera movement (e.g., 'Truck left', 'Steadicam follow', 'Slow push-in', 'Crane up'), and framing (e.g., 'Low angle', 'Over-the-shoulder', 'Wide master')." },
    mood: { type: Type.STRING, description: "Specific lighting setup (e.g., 'Rembrandt lighting', 'Neon rim light', 'Overcast softbox') and color grading palette." },
    audio: { type: Type.STRING, description: "Detailed Sound Design. Describe the Ambience (background noise), Sound Effects (sync to action), and Music/Score status. Ensure flow from previous shot." },
    dialogue: { type: Type.STRING, description: "Any dialogue or 'None'." },
    visual_prompt: { type: Type.STRING, description: "A highly detailed, self-contained prompt for Veo 3. MUST include: Subject details, Action, Environment, Lighting, Camera Angle, Lens Type, Film Stock, Audio keywords, and Style keywords." },
    reasoning: { type: Type.STRING, description: "Brief explanation of why this shot follows the previous one logically." }
  },
  required: ["action", "camera", "mood", "audio", "dialogue", "visual_prompt", "reasoning"],
};

// Helper to parse Data URL correctly
const parseDataUrl = (dataUrl: string) => {
  // More robust regex to handle various mime types (e.g. image/jpeg, image/png)
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid data URL format");
  }
  return {
    mimeType: matches[1],
    imageBytes: matches[2]
  };
};

// Helper for retrying operations with exponential backoff on 429 errors
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 5000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = 
      error.status === 429 || 
      error.code === 429 || 
      (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) ||
      error.status === 'RESOURCE_EXHAUSTED';

    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateShotDetails = async (
  outline: string,
  style: string,
  audioStyle: string,
  shotNumber: number,
  previousShots: Shot[]
): Promise<any> => {
  const ai = getAiClient();
  
  // Construct context from previous shots to maintain consistency
  const historyContext = previousShots.map(s => 
    `Shot ${s.id}: ${s.description}. Visuals: ${s.visualPrompt}. Audio: ${s.audio}`
  ).join("\n");

  const prompt = `
    You are a world-class Director of Photography, Sound Designer, and Film Director.
    
    Global Story Outline: "${outline}"
    Visual Style: "${style}"
    Audio/Soundtrack Style: "${audioStyle}"
    
    Your task: Plan Shot #${shotNumber} (Duration: 8 seconds).
    
    Context of previous shots (maintain continuity of characters, setting, lighting AND audio flow):
    ${historyContext || "This is the opening shot."}
    
    Instructions:
    1. **Cinematography**: Use technical language (e.g., "Rack focus," "Dolly zoom," "Anamorphic lens").
    2. **Sound Design**: Create an immersive audio landscape. If there was music in the previous shot, continue it. If there is a sudden action, describe the SFX.
    3. **Continuity**: Ensure character details and audio atmosphere flow naturally from the previous shot.
    
    Output a JSON object describing the shot.
    
    For the 'visual_prompt' field:
    - This goes directly to the Video AI (Veo 3).
    - Structure: [Subject + Action], [Environment], [Lighting], [Camera], [Audio/Sound Keywords], [Style].
    - IMPORTANT: Include specific audio instructions in this prompt so the video generator creates matching sound. Example: "...Soundtrack of intense ticking clock, muffled rain."
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: SHOT_SCHEMA,
      thinkingConfig: { thinkingBudget: 2048 }, 
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON", text);
    throw new Error("Invalid JSON format from Gemini");
  }
};

export const generateVideo = async (
  prompt: string,
  audioPrompt: string, // Specific audio instructions
  startFrame?: string, 
  referenceImages: AnnotatedImage[] = [] 
): Promise<string> => {
  const ai = getAiClient();
  
  // Determine Model & Prompt Strategy
  let model = "veo-3.1-generate-preview";
  if (startFrame) {
      model = "veo-3.1-fast-generate-preview";
  }

  // Combine Visual and Audio prompts for Veo
  // Veo 3 can generate audio if prompted.
  let finalPrompt = `${prompt} \n\nAudio/Sound: ${audioPrompt}`;

  // ALWAYS append reference image usage instructions to the prompt text.
  if (referenceImages.length > 0) {
    const usageInstructions = referenceImages
      .filter(img => img.label && img.label.trim().length > 0)
      .map((img, idx) => `[Reference Note ${idx + 1}: ${img.label}]`)
      .join(" ");
    
    if (usageInstructions) {
        finalPrompt = `${finalPrompt} \n\n${usageInstructions}`;
    }
  }

  console.log(`Generating video with model: ${model}`);
  console.log("Start frame present:", !!startFrame);

  let operation;
  
  try {
    const config: any = {
        numberOfVideos: 1,
        resolution: '720p', 
        aspectRatio: '16:9'
    };

    const requestPayload: any = {
      model,
      prompt: finalPrompt,
      config
    };

    if (startFrame) {
      const { mimeType, imageBytes } = parseDataUrl(startFrame);
      requestPayload.image = {
        imageBytes,
        mimeType
      };
    } else if (referenceImages.length > 0) {
      config.referenceImages = referenceImages.map(img => {
        const { mimeType, imageBytes } = parseDataUrl(img.url);
        return {
          image: {
            imageBytes,
            mimeType
          },
          referenceType: 'ASSET', 
        };
      });
    }

    operation = await retryWithBackoff(() => ai.models.generateVideos(requestPayload), 3, 5000);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await retryWithBackoff(() => ai.operations.getVideosOperation({ operation }), 3, 3000);
      console.log("Polling Veo operation status...");
    }

    if (operation.error) {
      console.error("Veo Operation Error:", operation.error);
      throw new Error(`Veo generation failed: ${operation.error.message || JSON.stringify(operation.error)}`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
       console.error("Full Operation Response:", operation);
       throw new Error("No video URI returned. The prompt may have been filtered.");
    }

    const downloadUrl = `${videoUri}&key=${process.env.API_KEY}`;
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to download video content: ${response.statusText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Veo generation error:", error);
    throw error;
  }
};
