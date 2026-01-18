

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
  audio: string; // Sound design prompt
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
  audioStyle: string; // Global audio context
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

// AIStudio is assumed to be provided by the environment's global Window interface.
// If the environment does not provide it, cast window to any where used to avoid TS errors.
