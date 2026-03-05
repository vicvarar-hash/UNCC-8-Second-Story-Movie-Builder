
import React, { useState, useEffect } from 'react';
import { 
  generateProjectPlan, 
  generateVideoAttempt, 
  suggestNextShotPlan, 
  sampleFrames, 
  runAISelfReview 
} from './services/gemini';
import { 
  Project, Shot, ShotPlan, GenerationAttempt, Outcome, 
  ValidationReview, SelfReviewRubric
} from "./types";
import { Spinner } from './components/Spinner';
import { 
  FilmIcon, SparklesIcon, Cog8ToothIcon, BeakerIcon, ArrowDownTrayIcon,
  CheckCircleIcon, XCircleIcon, InformationCircleIcon,
  DocumentTextIcon, ListBulletIcon, VideoCameraIcon, PlusIcon,
  ArrowPathIcon, ExclamationTriangleIcon, ChevronDownIcon,
  ChevronUpIcon, CloudArrowUpIcon, IdentificationIcon,
  DocumentDuplicateIcon, PencilSquareIcon, AdjustmentsVerticalIcon,
  EyeIcon, SpeakerWaveIcon, ShieldCheckIcon, TrashIcon,
  LockClosedIcon, LockOpenIcon
} from '@heroicons/react/24/solid';

const REQUIRED_PLAN_FIELDS = ["narrativeIntent", "videoPrompt", "action"] as const;

/** Validates plan structure before creating shots. Throws on missing required fields (schema drift detection). */
function validateShotPlan(plan: Partial<ShotPlan>, context?: string): asserts plan is ShotPlan {
  const missing = REQUIRED_PLAN_FIELDS.filter((f) => !plan[f] || String(plan[f]).trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `Plan structure validation failed: missing required fields (${missing.join(", ")}). ` +
        (context ? `Context: ${context}` : "Reject invalid plan before creating shots.")
    );
  }
}

const SCRIPTS = {
  "Script 1: Continuity Drift": {
    outline: "A lone woman walks slowly through a foggy forest at night. She wears a tattered red cloak. She picks up a glowing blue stone. Environment begins to shimmer.",
    style: "Cinematic, dark fantasy, foggy lighting, anamorphic lens, 24fps",
    numShots: 3,
    defaults: { useSeed: true, requestExplanation: false }
  },
  "Script 2: Plausible Planning Errors": {
    outline: "Two old friends meet again after many years apart in a bustling train station. They embrace and walk together toward the platform.",
    style: "Stylized realism, warm sunlight, busy background, wide shots",
    numShots: 3,
    defaults: { useSeed: false, requestExplanation: false }
  },
  "Script 3: Misleading Explanations": {
    outline: "A fast-paced chase through a crowded futuristic city. A hover-bike dodges stalls as a drone closes in.",
    style: "High energy, neon noir, fast motion blur, handheld camera feel",
    numShots: 3,
    defaults: { useSeed: true, requestExplanation: true }
  }
};

const App: React.FC = () => {
  const [phase, setPhase] = useState<'plan' | 'produce' | 'validate' | 'export'>('plan');
  const [project, setProject] = useState<Project>(() => {
    const saved = localStorage.getItem("EVAL_PROJECT");
    const defaultProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      title: "New Evaluation Project",
      createdAt: Date.now(),
      globalStoryPrompt: "",
      styleConstraints: "",
      audioIntent: "",
      contentConstraints: "",
      referenceImages: [],
      evaluationMode: true, 
      shots: [],
      runs: [],
      validationReviews: []
    };
    
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultProject,
        ...parsed,
        // Ensure new fields are initialized even if missing in parsed
        audioIntent: parsed.audioIntent || "",
        contentConstraints: parsed.contentConstraints || "",
        referenceImages: parsed.referenceImages || [],
        shots: parsed.shots || [],
        runs: parsed.runs || [],
        validationReviews: parsed.validationReviews || []
      };
    }
    return defaultProject;
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [renderProgress, setRenderProgress] = useState<string>('');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  
  const [validationTab, setValidationTab] = useState<'clip' | 'movie'>('clip');
  const [validationFile, setValidationFile] = useState<File | null>(null);
  const [validationContext, setValidationContext] = useState({
    story: project.globalStoryPrompt,
    constraints: project.styleConstraints,
    shotPlan: ""
  });

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio?.hasSelectedApiKey) {
        const selected = await aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem("EVAL_PROJECT", JSON.stringify(project));
  }, [project]);

  const handleOpenKeySelector = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio?.openSelectKey) {
      await aistudio.openSelectKey();
      setHasApiKey(true);
    } else {
      const key = prompt("Enter Gemini API Key (Standalone Mode):");
      if (key) {
        localStorage.setItem("GEMINI_API_KEY", key);
        setHasApiKey(true);
      }
    }
  };

  const handleResetProject = () => {
    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      title: "New Evaluation Project",
      createdAt: Date.now(),
      globalStoryPrompt: "",
      styleConstraints: "",
      audioIntent: "",
      contentConstraints: "",
      referenceImages: [],
      evaluationMode: true,
      shots: [],
      runs: [],
      validationReviews: []
    };
    setProject(newProject);
    setPhase('plan');
    setValidationFile(null);
    setValidationContext({ story: "", constraints: "", shotPlan: "" });
    localStorage.removeItem("EVAL_PROJECT");
  };

  const handleGeneratePlan = async () => {
    setIsProcessing(true);
    try {
      const plans = await generateProjectPlan(
        project.globalStoryPrompt, 
        project.styleConstraints, 
        project.audioIntent,
        project.contentConstraints,
        project.referenceImages,
        3
      );
      for (const p of plans) validateShotPlan(p, "generateProjectPlan");
      const newShots: Shot[] = plans.map((p, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        index: i,
        plan: p,
        attempts: [],
        acceptedAttemptId: null,
        status: 'planned'
      }));
      setProject(prev => ({ ...prev, shots: newShots }));
      setPhase('produce');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestNextShot = async () => {
    setIsProcessing(true);
    try {
      const plan = await suggestNextShotPlan(
        project.globalStoryPrompt, 
        project.styleConstraints, 
        project.audioIntent,
        project.contentConstraints,
        project.referenceImages,
        project.shots
      );
      validateShotPlan(plan, "suggestNextShotPlan");
      const newShot: Shot = {
        id: Math.random().toString(36).substr(2, 9),
        index: project.shots.length,
        plan,
        attempts: [],
        acceptedAttemptId: null,
        status: 'planned'
      };
      setProject(prev => ({ ...prev, shots: [...prev.shots, newShot] }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptShotState = (shotId: string, attemptId?: string) => {
    const shot = project.shots.find(s => s.id === shotId);
    if (!shot) return;

    if (!attemptId && shot.attempts.length === 0) {
      // First acceptance: Accept the plan to allow first generation
      const planAttempt: GenerationAttempt = {
        id: `plan-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        prompt: shot.plan.videoPrompt,
        modelInfo: "planning-gate",
        promptSource: 'original',
        metadata: { useSeed: false, useRefImage: false }
      };
      
      setProject(prev => ({
        ...prev,
        shots: prev.shots.map(s => s.id === shotId ? {
          ...s,
          attempts: [planAttempt],
          acceptedAttemptId: planAttempt.id
        } : s)
      }));
    } else if (attemptId) {
      // Accept a specific generated attempt
      setProject(prev => ({
        ...prev,
        shots: prev.shots.map(s => s.id === shotId ? {
          ...s,
          acceptedAttemptId: attemptId
        } : s)
      }));
    }
  };

  const handleGenerateShot = async (shotId: string) => {
    const shot = project.shots.find(s => s.id === shotId);
    if (!shot) return;

    // HARD ACCEPTANCE GATE: Block generation if not explicitly accepted by user
    if (!shot.acceptedAttemptId) {
      alert("PRODUCTION BLOCKED: You must explicitly 'Accept' the current plan or a previous version before generating video. This ensures human intent is logged in the evidence trace.");
      return;
    }

    setProject(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.id === shotId ? { ...s, status: 'generating' } : s)
    }));

    try {
      // Always use the prompt from the plan (which is editable in the UI)
      const attemptData = await generateVideoAttempt(shot.plan, { 
        useSeed: true, useRefImage: project.referenceImages.length > 0, requestExplanation: true 
      }, project.referenceImages);
      
      const newAttempt: GenerationAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        prompt: shot.plan.videoPrompt,
        videoUrl: attemptData.videoUrl,
        error: attemptData.error,
        modelInfo: attemptData.modelInfo || "unknown",
        promptSource: 'manual_edit',
        parentAttemptId: shot.acceptedAttemptId,
        metadata: attemptData.metadata || { useSeed: false, useRefImage: false }
      };

      setProject(prev => ({
        ...prev,
        shots: prev.shots.map(s => s.id === shotId ? { 
          ...s, 
          attempts: [...s.attempts, newAttempt],
          status: 'completed',
          // Note: We do NOT auto-accept the new generation. 
          // User must see it and click "Accept" to allow the NEXT regeneration.
          acceptedAttemptId: null 
        } : s)
      }));
    } catch (e: any) {
      setProject(prev => ({
        ...prev,
        shots: prev.shots.map(s => s.id === shotId ? { ...s, status: 'error' } : s)
      }));
    }
  };

  const handleCopyPrompt = async (revisedPrompt: string) => {
    try {
      await navigator.clipboard.writeText(revisedPrompt);
      alert("Revised prompt copied to clipboard! Paste it into the Technical Prompt area.");
    } catch (err) {
      alert("Failed to copy prompt.");
    }
  };

  const handleRunSelfReview = async (shotId: string) => {
    const shot = project.shots.find(s => s.id === shotId);
    // Use the most recent attempt for self-review
    const attempt = shot?.attempts[shot.attempts.length - 1];
    if (!attempt?.videoUrl) return;

    setRenderProgress("Running AI Self-Review...");
    try {
      const frames = await sampleFrames(attempt.videoUrl, 3);
      const result = await runAISelfReview(frames, {
        story: project.globalStoryPrompt,
        constraints: project.styleConstraints,
        plan: JSON.stringify(shot.plan),
        referenceImages: project.referenceImages
      });

      setProject(prev => ({
        ...prev,
        shots: prev.shots.map(s => s.id === shotId ? {
          ...s,
          attempts: s.attempts.map(a => a.id === attempt.id ? { ...a, selfReview: result } : a)
        } : s)
      }));
    } catch (e: any) {
      alert("Self-review failed: " + e.message);
    } finally {
      setRenderProgress("");
    }
  };

  const updateShotPlanField = (shotId: string, field: keyof ShotPlan, value: any) => {
    setProject(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.id === shotId ? {
        ...s,
        plan: { ...s.plan, [field]: value },
        // IMPORTANT: Edit invalidates acceptance
        acceptedAttemptId: null 
      } : s)
    }));
  };

  const handleRunValidationReview = async () => {
    if (!validationFile) return;
    setRenderProgress("AI Reviewing Uploaded Video...");
    try {
      const frames = await sampleFrames(validationFile, 4);
      const result = await runAISelfReview(frames, {
        story: validationContext.story,
        constraints: validationContext.constraints,
        plan: validationContext.shotPlan,
        referenceImages: project.referenceImages
      });
      const newReview: ValidationReview = {
        id: Math.random().toString(36).substr(2, 9),
        type: validationTab,
        filename: validationFile.name,
        timestamp: new Date().toISOString(),
        model: "gemini-3-flash-preview",
        context: {
          story: validationContext.story,
          constraints: validationContext.constraints,
          shotPlanJsonProvided: !!validationContext.shotPlan
        },
        result
      };
      setProject(prev => ({ ...prev, validationReviews: [newReview, ...prev.validationReviews] }));
    } catch (e: any) {
      alert("Validation failed: " + e.message);
    } finally { setRenderProgress(""); }
  };

  const updateOutcome = (shotId: string, updates: Partial<Outcome>) => {
    setProject(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.id === shotId ? {
        ...s,
        outcome: {
          failureType: s.outcome?.failureType || 'None',
          failureVisibility: s.outcome?.failureVisibility || 'Fully visible',
          trustCalibration: s.outcome?.trustCalibration || 'Calibrated',
          correctionEffort: s.outcome?.correctionEffort || 'Low',
          notes: s.outcome?.notes || '',
          ...updates
        }
      } : s)
    }));
  };

  const exportBundle = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence_bundle_${project.id}.json`;
    a.click();
  };

  const loadScript = (name: keyof typeof SCRIPTS) => {
    const script = SCRIPTS[name];
    setProject(prev => ({
      ...prev,
      globalStoryPrompt: script.outline,
      styleConstraints: script.style
    }));
  };

  const renderRubric = (rubric: SelfReviewRubric) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Narrative Consistency', val: rubric.narrativeConsistency },
          { label: 'Visual Fidelity', val: rubric.visualFidelity },
          { label: 'Continuity', val: rubric.continuity },
          { label: 'Physics & Logic', val: rubric.physicsAndLogic }
        ].map(item => (
          <div key={item.label} className="bg-gray-950 p-3 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase">{item.label}</span>
              <span className={`text-xs font-bold ${item.val.score > 3 ? 'text-green-400' : 'text-orange-400'}`}>
                {item.val.score}/5
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight italic">{item.val.reasoning}</p>
          </div>
        ))}
      </div>
      
      {rubric.promptRevision && (
        <div className="bg-gray-950 border border-indigo-500/20 rounded-xl overflow-hidden">
           <div className="bg-indigo-900/10 px-4 py-2 border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <SparklesIcon className="w-4 h-4 text-indigo-400" />
                 <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Suggested Prompt Revision</span>
              </div>
              <button 
                onClick={() => handleCopyPrompt(rubric.promptRevision!.revisedVideoPrompt)}
                className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold px-3 py-1 rounded flex items-center gap-1 transition-all active:scale-95"
              >
                <DocumentDuplicateIcon className="w-3 h-3" /> Copy Prompt
              </button>
           </div>
           <div className="p-4 space-y-3 text-[11px]">
              <div className="bg-black/50 p-3 rounded border border-gray-800 font-mono text-gray-300 whitespace-pre-wrap">
                 {rubric.promptRevision.revisedVideoPrompt}
              </div>
              <div className="flex gap-4">
                 <div className="flex-1">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Proposed Changes</span>
                    <ul className="text-gray-400 list-disc pl-4">
                       {rubric.promptRevision.changes.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  const EditShotDrawer = ({ shot }: { shot: Shot }) => (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur flex justify-end">
      <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 h-full overflow-y-auto p-8 shadow-2xl animate-in slide-in-from-right">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <AdjustmentsVerticalIcon className="w-6 h-6 text-indigo-500" />
            <h2 className="text-xl font-bold uppercase tracking-tight">Edit Shot Production Controls</h2>
          </div>
          <button onClick={() => setEditingShotId(null)} className="text-gray-500 hover:text-white transition-colors">
            <XCircleIcon className="w-8 h-8" />
          </button>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <EyeIcon className="w-4 h-4" /> Camera & Visuals
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Shot Type</label>
                <input value={shot.plan.shotType} onChange={e => updateShotPlanField(shot.id, 'shotType', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Movement</label>
                <input value={shot.plan.cameraMovement} onChange={e => updateShotPlanField(shot.id, 'cameraMovement', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Lens</label>
                <input value={shot.plan.lens} onChange={e => updateShotPlanField(shot.id, 'lens', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Color Palette</label>
                <input value={shot.plan.colorPalette} onChange={e => updateShotPlanField(shot.id, 'colorPalette', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Composition Notes</label>
              <textarea value={shot.plan.compositionNotes} onChange={e => updateShotPlanField(shot.id, 'compositionNotes', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mt-1 h-16" />
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-800 pt-6">
            <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl flex gap-3">
              <InformationCircleIcon className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-200 uppercase font-bold leading-tight">Editing these fields invalidates previous acceptance. You must re-sign the production gate before regenerating.</p>
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-800 pt-6">
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">Final Video Prompt (Artifact)</label>
            <textarea 
              value={shot.plan.videoPrompt} 
              onChange={e => updateShotPlanField(shot.id, 'videoPrompt', e.target.value)} 
              className="w-full bg-gray-950 border border-gray-700 rounded p-4 text-xs font-mono h-32 focus:ring-1 focus:ring-indigo-500" 
            />
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BeakerIcon className="w-7 h-7 text-indigo-500" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">AI Trust Lab</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Artifact-Driven Evaluation</p>
            </div>
          </div>
          
          <nav className="flex items-center bg-gray-800/50 p-1 rounded-xl">
            {(['plan', 'produce', 'validate', 'export'] as const).map(p => (
              <button key={p} onClick={() => setPhase(p)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${phase === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleResetProject} 
              className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 px-3 py-1.5 rounded-full border border-red-500/30 transition-all text-[10px] font-bold uppercase tracking-widest active:scale-95"
            >
              <TrashIcon className="w-4 h-4" /> Reset Project
            </button>
            <button onClick={handleOpenKeySelector} className={`p-2 rounded-full transition-colors ${!hasApiKey ? 'bg-red-600/20 animate-pulse' : 'hover:bg-gray-800'}`}>
              <Cog8ToothIcon className={`w-5 h-5 ${!hasApiKey ? 'text-red-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>
      </header>

      {renderProgress && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
           <Spinner size="lg" className="text-indigo-500 mb-4" />
           <p className="text-xl font-bold text-white tracking-wide uppercase">{renderProgress}</p>
        </div>
      )}

      {editingShotId && (
        <EditShotDrawer shot={project.shots.find(s => s.id === editingShotId)!} />
      )}

      <main className="max-w-6xl mx-auto p-6 pb-40">
        {phase === 'plan' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" /> Load Preset Script
                </h3>
                <div className="space-y-2">
                  {Object.keys(SCRIPTS).map(name => (
                    <button key={name} onClick={() => loadScript(name as any)} className="w-full text-left p-3 text-xs bg-gray-800 hover:bg-indigo-900/30 border border-gray-700 rounded-xl transition-all">
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Story Intent</label>
                    <textarea value={project.globalStoryPrompt} onChange={e => setProject(prev => ({ ...prev, globalStoryPrompt: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 min-h-[120px] outline-none focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Global Story Intent..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Style Constraints</label>
                      <input value={project.styleConstraints} onChange={e => setProject(prev => ({ ...prev, styleConstraints: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Style Constraints..." />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Audio Intent</label>
                      <input value={project.audioIntent} onChange={e => setProject(prev => ({ ...prev, audioIntent: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Audio Intent (e.g., Orchestral, Lo-fi)..." />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Content Constraints</label>
                    <input value={project.contentConstraints} onChange={e => setProject(prev => ({ ...prev, contentConstraints: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="Content Constraints (e.g., No violence, PG-rated)..." />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Reference Images (Optional)</label>
                    <div className="flex flex-wrap gap-4">
                      {(project.referenceImages || []).map(img => (
                        <div key={img.id} className="relative group">
                          <img src={img.url} alt={img.label} className="w-20 h-20 object-cover rounded-lg border border-gray-700" />
                          <button 
                            onClick={() => setProject(prev => ({ ...prev, referenceImages: (prev.referenceImages || []).filter(i => i.id !== img.id) }))}
                            className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircleIcon className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg hover:border-indigo-500 cursor-pointer transition-all">
                        <PlusIcon className="w-6 h-6 text-gray-500" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const url = event.target?.result as string;
                                setProject(prev => ({
                                  ...prev,
                                  referenceImages: [...(prev.referenceImages || []), { id: Math.random().toString(36).substr(2, 9), url, label: file.name }]
                                }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleGeneratePlan} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all">
                      {isProcessing ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />} Full Plan (3 Shots)
                    </button>
                    <button onClick={handleSuggestNextShot} disabled={isProcessing} className="bg-gray-800 hover:bg-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-sm text-indigo-300 border border-indigo-500/20">
                      {isProcessing ? <Spinner size="sm" /> : <ArrowPathIcon className="w-4 h-4" />} Suggest Next
                    </button>
                  </div>
                </div>
              </div>

              {project.shots.map((shot, idx) => (
                <div key={shot.id} className="bg-gray-900 p-6 border border-gray-800 rounded-2xl space-y-4 shadow-lg hover:border-indigo-500/50 transition-all group">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Shot {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingShotId(shot.id)} className="p-2 text-gray-500 hover:text-indigo-400 transition-colors bg-gray-800 rounded-lg">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setProject(prev => ({ ...prev, shots: prev.shots.filter(s => s.id !== shot.id) }))} className="p-2 text-gray-500 hover:text-red-500 transition-colors bg-gray-800 rounded-lg">
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-3 gap-6">
                      <div className="col-span-2 space-y-2">
                        <p className="text-sm font-bold text-gray-200">{shot.plan.narrativeIntent}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700 font-bold">{shot.plan.shotType}</span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700 font-bold">{shot.plan.cameraMovement}</span>
                        </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'produce' && (
          <div className="space-y-12">
            {project.shots.map(shot => {
              const acceptedAttempt = shot.attempts.find(a => a.id === shot.acceptedAttemptId);
              const isAccepted = !!shot.acceptedAttemptId;

              return (
                <div key={shot.id} className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl transition-all">
                  <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{shot.index + 1}</span>
                      <h3 className="font-bold text-gray-100">{shot.plan.narrativeIntent}</h3>
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all ${isAccepted ? 'bg-green-900/20 text-green-400 border-green-500/50' : 'bg-red-900/20 text-red-400 border-red-500/50'}`}>
                        {isAccepted ? <><CheckCircleIcon className="w-3 h-3" /> Accepted</> : <><ExclamationTriangleIcon className="w-3 h-3" /> Not Accepted</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       {!isAccepted && (
                         <span className="text-[9px] font-bold text-red-500 animate-pulse uppercase">Production Blocked</span>
                       )}
                       <button 
                        onClick={() => handleGenerateShot(shot.id)} 
                        disabled={shot.status === 'generating' || !isAccepted} 
                        className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg active:scale-95 ${!isAccepted ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                      >
                        {shot.status === 'generating' ? <Spinner size="sm" /> : <VideoCameraIcon className="w-4 h-4" />}
                        {shot.attempts.length > 1 ? "Regenerate" : "Generate"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-6 border-r border-gray-800 space-y-6 bg-gray-900/50">
                      <div id={`prompt-area-${shot.id}`} className="bg-gray-950 p-4 rounded-xl border border-gray-800 transition-all duration-500 group focus-within:border-indigo-500 focus-within:bg-indigo-900/5">
                        <div className="flex justify-between items-center mb-2">
                           <label className="text-[10px] font-bold text-gray-500 uppercase group-focus-within:text-indigo-400 transition-colors">Active Technical Prompt</label>
                           <button onClick={() => setEditingShotId(shot.id)} className="text-[9px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 uppercase">
                              <AdjustmentsVerticalIcon className="w-3 h-3" /> Production Settings
                           </button>
                        </div>
                        <textarea 
                          value={shot.plan.videoPrompt}
                          onChange={e => updateShotPlanField(shot.id, 'videoPrompt', e.target.value)}
                          className="w-full bg-transparent text-[11px] text-gray-200 font-mono leading-relaxed outline-none border-none resize-none h-32 focus:ring-0 custom-scrollbar"
                          spellCheck={false}
                        />
                      </div>

                      {/* Acceptance Gate UI Section */}
                      <div className="bg-black/40 border border-gray-800 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <LockClosedIcon className={`w-4 h-4 ${isAccepted ? 'text-green-500' : 'text-gray-600'}`} />
                           <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Acceptance Gate</h4>
                        </div>
                        
                        {!isAccepted ? (
                          <div className="space-y-3">
                            <p className="text-[10px] text-gray-400 leading-relaxed italic">The production gate is currently locked. To proceed with generation, you must explicitly accept the current configuration as the intended narrative baseline.</p>
                            <button 
                              onClick={() => handleAcceptShotState(shot.id)}
                              className="w-full bg-indigo-900/30 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/50 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <ShieldCheckIcon className="w-4 h-4" /> Accept Plan for Production
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                             <div className="bg-green-900/10 border border-green-500/20 p-3 rounded-lg flex items-start gap-3">
                                <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                   <p className="text-[10px] font-bold text-green-400 uppercase">Configuration Accepted</p>
                                   <p className="text-[9px] text-green-600/70 mt-0.5 font-mono">ID: {shot.acceptedAttemptId}</p>
                                </div>
                             </div>
                             <button 
                              onClick={() => setProject(prev => ({ ...prev, shots: prev.shots.map(s => s.id === shot.id ? { ...s, acceptedAttemptId: null } : s) }))}
                              className="text-[9px] font-bold text-gray-600 hover:text-red-500 uppercase tracking-widest"
                            >
                              Revoke Acceptance
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-black flex flex-col aspect-video items-center justify-center relative">
                      {shot.status === 'generating' ? (
                        <div className="flex flex-col items-center gap-3">
                          <Spinner size="lg" className="text-indigo-500" />
                          <p className="text-[10px] font-bold text-gray-600 animate-pulse tracking-widest uppercase">VEO Gen Active</p>
                        </div>
                      ) : (shot.attempts.length > 0 && shot.attempts[shot.attempts.length-1].videoUrl) ? (
                        <video 
                          key={shot.attempts[shot.attempts.length-1].id} 
                          src={shot.attempts[shot.attempts.length-1].videoUrl} 
                          controls 
                          className="w-full h-full object-contain bg-black" 
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 opacity-20">
                           <FilmIcon className="w-16 h-16" />
                           <p className="text-xs font-bold uppercase tracking-widest">No Artifact Generated</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evaluation & Self-Review Panels */}
                  <div className="bg-indigo-950/20 border-t border-indigo-500/10 p-6 space-y-8">
                    
                    {/* Panel 1: AI Self-Review */}
                    <div className="max-w-4xl mx-auto space-y-4">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">AI Trace Analysis</h4>
                      </div>
                      <div className="bg-gray-900/50 rounded-2xl border border-indigo-500/10 p-6 shadow-inner">
                        {(shot.attempts.length > 0 && shot.attempts[shot.attempts.length-1].videoUrl) ? (
                          <>
                            {!shot.attempts[shot.attempts.length-1].selfReview ? (
                              <div className="text-center py-4">
                                <button onClick={() => handleRunSelfReview(shot.id)} className="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-6 py-2 rounded-full transition-all flex items-center gap-2 mx-auto shadow-lg shadow-indigo-600/20 active:scale-95">
                                  <ArrowPathIcon className="w-4 h-4" /> Analyze Latest Version
                                </button>
                                <p className="text-[9px] text-gray-500 mt-2 uppercase tracking-tight">AI self-review identifies drift & suggests technical improvements</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {renderRubric(shot.attempts[shot.attempts.length-1].selfReview!)}
                                <button onClick={() => handleRunSelfReview(shot.id)} className="text-[10px] text-gray-500 hover:text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1 mx-auto transition-colors">
                                  <ArrowPathIcon className="w-3 h-3" /> Re-Analyze
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-10 opacity-50">
                            <ExclamationTriangleIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs font-bold text-gray-600 uppercase">Artifact Required for Analysis</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Panel 2: Outcome Coding */}
                    <div className="max-w-4xl mx-auto space-y-4">
                      <div className="flex items-center gap-2">
                        <BeakerIcon className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Trust Calibration (Human)</h4>
                      </div>
                      <div className="bg-gray-900/50 rounded-2xl border border-indigo-500/10 p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {['failureType', 'failureVisibility', 'trustCalibration', 'correctionEffort'].map(field => (
                            <div key={field} className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase">{field.replace(/([A-Z])/g, ' $1')}</label>
                              <select 
                                value={shot.outcome?.[field as keyof Outcome] as string || ''}
                                onChange={e => updateOutcome(shot.id, { [field]: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                              >
                                {field === 'failureType' ? ['None', 'Continuity Drift', 'Hallucination', 'Instruction Following', 'Physics Violation', 'Aesthetic Failure'].map(v => <option key={v}>{v}</option>) :
                                field === 'failureVisibility' ? ['Fully visible', 'Partially visible', 'Silent'].map(v => <option key={v}>{v}</option>) :
                                field === 'trustCalibration' ? ['Under-trust', 'Calibrated', 'Over-trust'].map(v => <option key={v}>{v}</option>) :
                                ['Low', 'Medium', 'High'].map(v => <option key={v}>{v}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                        <textarea 
                          value={shot.outcome?.notes || ''}
                          onChange={e => updateOutcome(shot.id, { notes: e.target.value })}
                          className="w-full mt-4 bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs h-20 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" 
                          placeholder="Evidence logs (Critical for Trust Lab)..."
                        />
                      </div>
                    </div>

                    {/* Attempts Trace Log */}
                    <div className="max-w-4xl mx-auto pt-4 border-t border-indigo-500/10">
                       <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest block mb-3">Lineage History ({shot.attempts.length})</span>
                       <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
                          {shot.attempts.map((att, i) => (
                            <div key={att.id} className="flex-shrink-0 flex flex-col gap-2">
                               <button 
                                onClick={() => setProject(prev => ({ 
                                  ...prev, 
                                  shots: prev.shots.map(s => s.id === shot.id ? { 
                                    ...s, 
                                    acceptedAttemptId: att.id 
                                  } : s) 
                                }))} 
                                className={`w-36 bg-gray-800 p-2 rounded-lg border transition-all ${shot.acceptedAttemptId === att.id ? 'border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500/50 scale-105' : 'border-gray-700 opacity-60 hover:opacity-100 hover:scale-105'}`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-gray-400">V{i + 1}</span>
                                    <span className="text-[8px] font-bold px-1 rounded bg-gray-900 text-gray-500 uppercase">{att.id.includes('plan') ? 'plan' : 'vid'}</span>
                                </div>
                                <div className="h-14 bg-black rounded flex items-center justify-center overflow-hidden">
                                    {att.videoUrl ? <video src={att.videoUrl} className="w-full h-full object-cover" /> : <IdentificationIcon className="w-6 h-6 text-gray-800" />}
                                </div>
                                <div className="mt-2 text-center">
                                  <span className={`text-[8px] font-bold uppercase tracking-tighter ${shot.acceptedAttemptId === att.id ? 'text-indigo-400' : 'text-gray-600'}`}>
                                    {shot.acceptedAttemptId === att.id ? 'Accepted Baseline' : 'Version History'}
                                  </span>
                                </div>
                              </button>
                              {shot.acceptedAttemptId !== att.id && (
                                <button 
                                  onClick={() => handleAcceptShotState(shot.id, att.id)}
                                  className="text-[8px] font-bold text-indigo-400 hover:text-white uppercase tracking-widest bg-indigo-900/10 py-1 rounded border border-indigo-500/10"
                                >
                                  Accept This Version
                                </button>
                              )}
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {phase === 'validate' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
              <div className="bg-gray-800/50 p-1 flex">
                {['clip', 'movie'].map(t => (
                  <button key={t} onClick={() => setValidationTab(t as any)} className={`flex-1 py-3 text-xs font-bold rounded-2xl transition-all ${validationTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                    Validate {t === 'clip' ? 'Shot' : 'Movie'}
                  </button>
                ))}
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="relative group">
                    <input type="file" accept="video/mp4,video/webm" onChange={(e) => setValidationFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="border-2 border-dashed border-gray-800 group-hover:border-indigo-500/50 rounded-2xl p-8 transition-all bg-gray-950/50 flex flex-col items-center justify-center text-center">
                      {validationFile ? (
                        <><CheckCircleIcon className="w-10 h-10 text-green-500 mb-2" /><p className="text-sm font-bold text-gray-200">{validationFile.name}</p></>
                      ) : (
                        <><CloudArrowUpIcon className="w-10 h-10 text-gray-700 group-hover:text-indigo-500 mb-2 transition-colors" /><p className="text-xs font-bold text-gray-400 uppercase">Drop mp4/webm</p></>
                      )}
                    </div>
                  </div>
                  <button onClick={handleRunValidationReview} disabled={!validationFile} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <SparklesIcon className="w-5 h-5" /> Run Validator
                  </button>
                </div>

                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                   {project.validationReviews.map(rev => (
                      <div key={rev.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg mb-6">
                         <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-800 flex justify-between items-center text-[10px]">
                            <span className="font-bold text-indigo-400 uppercase">{rev.type} Review</span>
                            <span className="text-gray-500">{new Date(rev.timestamp).toLocaleString()}</span>
                         </div>
                         <div className="p-4">{renderRubric(rev.result)}</div>
                      </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'export' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-500">
             <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 text-center space-y-6 shadow-2xl">
                <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/50">
                   <ArrowDownTrayIcon className="w-10 h-10 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Export Evidence Bundle</h2>
                  <p className="text-gray-500 text-sm mt-2">Bundle includes all versions, plan drafts, AI reviews, and human outcome logs for research audit.</p>
                </div>
                <button onClick={exportBundle} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                  <ArrowDownTrayIcon className="w-6 h-6" /> Download Bundle (.json)
                </button>
             </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-4 left-4 bg-gray-900/80 backdrop-blur border border-indigo-500/30 rounded-full px-4 py-1.5 flex items-center gap-3 z-50 shadow-2xl border-opacity-50">
        <ShieldCheckIcon className="w-4 h-4 text-green-500" />
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">Evaluation Instrument: State Trace Active</span>
      </footer>
    </div>
  );
};

export default App;
