
export interface AnnotatedImage {
  id: string;
  url: string;
  label: string; // User's intent, e.g. "Use for Sara's face"
}

export interface Shot {
  id: number;
  description: string;
  action: string;
  camera: string;
  mood: string;
  audio: string; // New field for sound design
  dialogue: string;
  visualPrompt: string;
  videoUrl?: string;
  status: 'pending' | 'draft' | 'generating_video' | 'completed' | 'error';
  error?: string;
  
  // New fields for per-shot control
  shotReferenceImages: AnnotatedImage[];
  previousFrameUrl?: string;
  usePreviousFrame: boolean;
  
  // UI State
  isEditing?: boolean;
}

export interface StoryState {
  outline: string;
  style: string;
  audioStyle: string; // New global audio context
  referenceImages: string[]; 
  shots: Shot[];
}

export interface GeminiShotResponse {
  action: string;
  camera: string;
  mood: string;
  audio: string;
  dialogue: string;
  visual_prompt: string;
  reasoning: string;
}

// Extend AIStudio interface directly to avoid conflict with existing Window.aistudio definition
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
