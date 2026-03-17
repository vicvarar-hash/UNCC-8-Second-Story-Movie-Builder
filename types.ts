
export type FailureType = 'None' | 'Continuity Drift' | 'Hallucination' | 'Instruction Following' | 'Physics Violation' | 'Aesthetic Failure';
export type FailureVisibility = 'Fully visible' | 'Partially visible' | 'Silent';
export type TrustCalibration = 'Under-trust' | 'Calibrated' | 'Over-trust';
export type CorrectionEffort = 'Low' | 'Medium' | 'High';

export interface PromptRevision {
  revisedVideoPrompt: string;
  changes: string[];
  regenerationHints: string[];
}

export interface SelfReviewRubric {
  narrativeConsistency: { score: number; reasoning: string };
  visualFidelity: { score: number; reasoning: string };
  continuity: { score: number; reasoning: string };
  physicsAndLogic: { score: number; reasoning: string };
  overallConfidence: 'Low' | 'Medium' | 'High';
  summary: string;
  promptRevision?: PromptRevision;
}

export interface Outcome {
  failureType: FailureType;
  failureVisibility: FailureVisibility;
  trustCalibration: TrustCalibration;
  correctionEffort: CorrectionEffort;
  notes: string;
}

export interface GenerationAttempt {
  id: string;
  timestamp: number;
  prompt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  explanation?: string;
  confidence?: string;
  error?: string;
  modelInfo: string;
  promptSource?: 'original' | 'self_review_revision' | 'manual_edit';
  parentAttemptId?: string;
  metadata: {
    useSeed: boolean;
    useRefImage: boolean;
  };
  selfReview?: SelfReviewRubric;
  /** Base64 JPEG data URL of the video's last frame — used as continuity seed for the next shot */
  lastFrameUrl?: string;
}

export interface ValidationReview {
  id: string;
  type: 'clip' | 'movie';
  filename: string;
  timestamp: string;
  model: string;
  context: {
    story: string;
    constraints: string;
    scenarioId?: string;
    shotPlanJsonProvided: boolean;
  };
  result: SelfReviewRubric;
}

export interface ShotPlan {
  narrativeIntent: string;
  // Camera / Visual
  shotType: string;
  cameraMovement: string;
  cameraAngle: string;
  lens: string;
  framingSubject: string;
  compositionNotes: string;
  colorPalette: string;
  vfxNotes: string;
  // Sound
  soundBed: string;
  musicCue: string;
  sfx: string[];
  dialogueStyle: string;
  // Continuity + constraints
  continuityLocks: string[];
  keyProps: string[];
  characterState: string;
  mustInclude: string[];
  mustAvoid: string[];
  // Logic
  assumptions: string[];
  action: string;
  camera: string; // Simplified summary of camera
  mood: string;
  audioIntent: string;
  dialogue: string;
  videoPrompt: string;
}

export interface Shot {
  id: string;
  index: number;
  plan: ShotPlan;
  attempts: GenerationAttempt[];
  acceptedAttemptId: string | null;
  status: 'planned' | 'generating' | 'completed' | 'error';
  outcome?: Outcome;
}

export interface EvaluationRun {
  id: string;
  scenarioId: string;
  timestampStart: number;
  timestampEnd?: number;
  outcomes: Record<string, Outcome>;
}

export interface Project {
  id: string;
  title: string;
  createdAt: number;
  globalStoryPrompt: string;
  styleConstraints: string;
  audioIntent: string;
  contentConstraints: string;
  referenceImages: AnnotatedImage[];
  evaluationMode: boolean; // Always true in this version
  shots: Shot[];
  runs: EvaluationRun[];
  validationReviews: ValidationReview[];
}

export interface AnnotatedImage {
  id: string;
  url: string;
  label: string;
}

export interface GeminiShotResponse {
  shots: ShotPlan[];
}
