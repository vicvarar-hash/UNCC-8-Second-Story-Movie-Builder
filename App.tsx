
import React, { useState, useEffect, useRef } from 'react';
import { generateShotDetails, generateVideo, getCurrentApiKey } from './services/gemini';
import { Shot, GeminiShotResponse, AnnotatedImage } from './types';
import { Spinner } from './components/Spinner';
import { FilmIcon, VideoCameraIcon, SparklesIcon, PhotoIcon, ArrowRightIcon, ArrowDownTrayIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, LinkIcon, PlayIcon, ArrowPathIcon, ArrowDownOnSquareIcon, MusicalNoteIcon, KeyIcon, InformationCircleIcon, ExclamationTriangleIcon, Cog8ToothIcon, ArrowDownTrayIcon as DownloadIcon } from '@heroicons/react/24/solid';

// --- Utility: Movie Rendering ---

const loadVideoForRender = (url: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = "anonymous";
        video.muted = false; 
        video.preload = 'auto';
        const timeout = setTimeout(() => reject(new Error("Timeout")), 30000);
        video.onloadeddata = () => { clearTimeout(timeout); resolve(video); };
        video.onerror = (e) => { clearTimeout(timeout); reject(new Error("Load failed")); };
    });
};

const renderAndDownloadMovie = async (shots: Shot[], onProgress: (msg: string) => void) => {
  const completedShots = shots.filter(s => s.status === 'completed' && s.videoUrl);
  if (completedShots.length === 0) return;
  let audioCtx: AudioContext | null = null;
  try {
    onProgress("Initializing Studio...");
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const dest = audioCtx.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(30); 
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
    const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.start();
    const recordShot = async (video: HTMLVideoElement, index: number, total: number): Promise<void> => {
        return new Promise((resolve) => {
            onProgress(`Rendering Shot ${index + 1} / ${total}...`);
            let timeout = setTimeout(() => resolve(), 15000);
            try {
                if (audioCtx) {
                    const sourceNode = audioCtx.createMediaElementSource(video);
                    const gainNode = audioCtx.createGain();
                    sourceNode.connect(gainNode); gainNode.connect(dest);
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.3);
                }
            } catch (e) {}
            const draw = () => { if (!video.paused && !video.ended) { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); requestAnimationFrame(draw); } };
            video.onended = () => { clearTimeout(timeout); resolve(); };
            video.onerror = () => { clearTimeout(timeout); resolve(); };
            video.play().then(() => draw()).catch(() => resolve());
        });
    };
    for (let i = 0; i < completedShots.length; i++) {
        const video = await loadVideoForRender(completedShots[i].videoUrl!);
        await recordShot(video, i, completedShots.length);
    }
    onProgress("Finalizing Movie...");
    await new Promise(r => setTimeout(r, 1000));
    mediaRecorder.stop();
    await new Promise<void>(resolve => { mediaRecorder.onstop = () => resolve(); });
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `8-second-story.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (error) {
      alert("Render failed. Check console.");
  } finally { onProgress(""); if (audioCtx) audioCtx.close(); }
};

// --- Main App ---

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  
  const [step, setStep] = useState<'setup' | 'production'>('setup');
  const [outline, setOutline] = useState('');
  const [style, setStyle] = useState('');
  const [audioStyle, setAudioStyle] = useState(''); 
  const [shots, setShots] = useState<Shot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessText, setCurrentProcessText] = useState('');
  const [isPlayingMovie, setIsPlayingMovie] = useState(false);
  const [renderProgress, setRenderProgress] = useState('');

  const checkKey = () => {
    try {
      getCurrentApiKey();
      setHasKey(true);
      setShowKeyModal(false);
    } catch (e) {
      setHasKey(false);
    }
  };

  useEffect(() => {
    checkKey();
    const stored = localStorage.getItem("GEMINI_API_KEY");
    if (stored) setApiKeyInput(stored);
  }, []);

  const saveApiKey = () => {
    if (apiKeyInput.length > 10) {
      localStorage.setItem("GEMINI_API_KEY", apiKeyInput);
      checkKey();
    } else {
      alert("Please enter a valid Gemini API key.");
    }
  };

  const handleSelectKeyFromStudio = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio?.openSelectKey) {
      await aistudio.openSelectKey();
      setHasKey(true);
      setShowKeyModal(false);
    }
  };

  const prepareNextShot = async () => {
    setIsProcessing(true);
    const shotNumber = shots.length + 1;
    setCurrentProcessText(`Directing Shot #${shotNumber}...`);
    try {
      const details = await generateShotDetails(outline, style, audioStyle || 'Cinematic', shotNumber, shots);
      const newShot: Shot = {
        id: shotNumber, description: details.reasoning, action: details.action, camera: details.camera,
        mood: details.mood, audio: details.audio, dialogue: details.dialogue, visualPrompt: details.visual_prompt,
        status: 'draft', shotReferenceImages: [], usePreviousFrame: false, isEditing: true 
      };
      setShots(prev => [...prev, newShot]);
    } catch (error: any) {
      if (error.message.includes("API key")) setShowKeyModal(true);
      else alert("Failed to plan shot.");
    } finally { setIsProcessing(false); }
  };

  const handleGenerateVideo = async (shotId: number) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    setIsProcessing(true);
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'generating_video', isEditing: false, error: undefined } : s));
    setCurrentProcessText(`Filming Shot #${shotId} with Veo 3...`);
    try {
      const videoUrl = await generateVideo(shot.visualPrompt, shot.audio);
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, videoUrl, status: 'completed' } : s));
    } catch (error: any) {
      let msg = error?.message || "Generation failed";
      if (msg.includes("REAUTH_REQUIRED") || msg.includes("API key")) setShowKeyModal(true);
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'error', isEditing: true, error: msg } : s));
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500">
      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-indigo-500" /> API Key Required
            </h2>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              To use Veo 3 in production, please provide a Gemini API key from a project with billing enabled.
            </p>
            <input 
              type="password" 
              value={apiKeyInput} 
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste your Gemini API Key here" 
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button onClick={saveApiKey} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold mb-4">Save Key</button>
            <div className="text-center">
              <button onClick={handleSelectKeyFromStudio} className="text-gray-500 hover:text-white text-xs underline">Or select project from AI Studio</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-900/50 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep('setup')}>
            <FilmIcon className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight">8-Second Story</h1>
          </div>
          <button onClick={() => setShowKeyModal(true)} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
            <Cog8ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-40">
        {step === 'setup' ? (
          <div className="max-w-2xl mx-auto mt-10 space-y-8">
            <h2 className="text-3xl font-bold mb-6 text-center">Pre-Production</h2>
            <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 space-y-6">
              <textarea value={outline} onChange={(e) => setOutline(e.target.value)} placeholder="Story Outline..." className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 h-32 outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Visual Style..." className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 outline-none" />
                <input value={audioStyle} onChange={(e) => setAudioStyle(e.target.value)} placeholder="Audio Style..." className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 outline-none" />
              </div>
              <button onClick={() => { setStep('production'); prepareNextShot(); }} disabled={!outline || !style} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold">Start Production</button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {shots.map(shot => (
              <div key={shot.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="bg-gray-800/50 p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-semibold">Shot #{shot.id}</h3>
                  {shot.status === 'completed' && <button onClick={() => renderAndDownloadMovie([shot], setRenderProgress)} className="text-xs text-indigo-400 hover:underline">Download Shot</button>}
                </div>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">{shot.action}</p>
                    <p className="text-xs italic text-indigo-300">Audio: {shot.audio}</p>
                    {shot.status === 'draft' && <button onClick={() => handleGenerateVideo(shot.id)} className="w-full bg-indigo-600 py-2 rounded-lg text-sm font-bold">Film Shot</button>}
                  </div>
                  <div className="bg-black/50 aspect-video rounded-xl flex items-center justify-center relative overflow-hidden border border-gray-800">
                    {shot.status === 'completed' ? <video src={shot.videoUrl} controls className="w-full h-full object-cover" /> : shot.status === 'generating_video' ? <Spinner /> : <VideoCameraIcon className="w-10 h-10 opacity-10" />}
                  </div>
                </div>
              </div>
            ))}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <button onClick={prepareNextShot} className="bg-indigo-600 px-8 py-3 rounded-full font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                {isProcessing ? <Spinner size="sm" /> : <SparklesIcon className="w-4 h-4" />} Next Shot
              </button>
              <button onClick={() => renderAndDownloadMovie(shots, setRenderProgress)} className="bg-gray-800 px-8 py-3 rounded-full font-bold hover:bg-gray-700">Download Movie</button>
            </div>
          </div>
        )}
      </main>
      {renderProgress && <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center"><div className="text-center space-y-4"><Spinner size="lg" /><p>{renderProgress}</p></div></div>}
    </div>
  );
};

export default App;
