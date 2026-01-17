import React, { useState, useEffect, useRef } from 'react';
import { generateShotDetails, generateVideo } from './services/gemini';
import { Shot, GeminiShotResponse, AnnotatedImage } from './types';
import { Spinner } from './components/Spinner';
import { FilmIcon, VideoCameraIcon, SparklesIcon, PhotoIcon, ArrowRightIcon, ArrowDownTrayIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, LinkIcon, PlayIcon, ArrowPathIcon, ArrowDownOnSquareIcon, MusicalNoteIcon } from '@heroicons/react/24/solid';

// --- Utility: Movie Rendering (Gapless & Audio Fades) ---

const loadVideoForRender = (url: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = "anonymous";
        video.muted = false; // Must be false to capture audio track
        video.preload = 'auto';
        
        video.onloadeddata = () => resolve(video);
        video.onerror = (e) => reject(e);
    });
};

const renderAndDownloadMovie = async (shots: Shot[], onProgress: (msg: string) => void) => {
  const completedShots = shots.filter(s => s.status === 'completed' && s.videoUrl);
  if (completedShots.length === 0) return;

  try {
    onProgress("Initializing Studio...");
    
    const canvas = document.createElement('canvas');
    canvas.width = 1280; 
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not create canvas context");

    // Audio Context for mixing and fading
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Combine canvas video stream + audio destination stream
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
    ]);

    const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9'
    });
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.start();

    // Helper to play a single video through the mixing pipeline
    const recordShot = async (video: HTMLVideoElement, isLast: boolean): Promise<void> => {
        return new Promise((resolve) => {
            onProgress(`Rendering Shot...`);

            let sourceNode: MediaElementAudioSourceNode | null = null;
            let gainNode: GainNode | null = null;

            try {
                // Audio Routing & Fading
                sourceNode = audioCtx.createMediaElementSource(video);
                gainNode = audioCtx.createGain();
                
                sourceNode.connect(gainNode);
                gainNode.connect(dest);

                // Fade In (0.5s)
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.5);

                const duration = video.duration;
                if (duration > 1) {
                    gainNode.gain.setValueAtTime(1, audioCtx.currentTime + duration - 0.5);
                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
                }

            } catch (e) {
                console.warn("Audio routing failed:", e);
            }

            const draw = () => {
                if (video.paused || video.ended) {
                    return;
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(draw);
            };

            video.onended = () => {
                resolve();
            };

            video.play().then(() => {
                draw();
            }).catch(e => {
                console.error("Auto-play failed in renderer", e);
                resolve(); 
            });
        });
    };

    // --- Pipeline Execution ---
    
    // Pre-load the first video
    let nextVideoPromise = loadVideoForRender(completedShots[0].videoUrl!);

    for (let i = 0; i < completedShots.length; i++) {
        const currentVideo = await nextVideoPromise;
        
        // Start loading the next one IMMEDIATELY while we record the current one
        if (i + 1 < completedShots.length) {
            nextVideoPromise = loadVideoForRender(completedShots[i+1].videoUrl!);
        }

        onProgress(`Recording Shot ${completedShots[i].id} / ${completedShots.length}...`);
        await recordShot(currentVideo, i === completedShots.length - 1);
    }

    onProgress("Finalizing Movie...");
    
    // Add a tiny buffer at the end ensures last frame is captured
    await new Promise(r => setTimeout(r, 500));

    mediaRecorder.stop();
    await new Promise<void>(resolve => { mediaRecorder.onstop = () => resolve(); });

    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `8-second-story-full_movie.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    onProgress(""); 
    audioCtx.close();

  } catch (error) {
      console.error("Render failed", error);
      onProgress("");
      alert("Failed to render movie. See console for details.");
  }
};


// --- Component: Seamless Player (Optimized) ---

interface SeamlessPlayerProps {
    shots: Shot[];
    onClose: () => void;
    onDownload: () => void;
}

const SeamlessPlayer: React.FC<SeamlessPlayerProps> = ({ shots, onClose, onDownload }) => {
    const completedShots = shots.filter(s => s.status === 'completed');
    
    // State for UI rendering
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
    
    // Refs for Loop State (Critical to avoid stale closures in requestAnimationFrame)
    const indexRef = useRef(0);
    const activePlayerRef = useRef<1 | 2>(1);
    
    const video1Ref = useRef<HTMLVideoElement>(null);
    const video2Ref = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number>();

    // Audio Fades
    const fadeIn = (video: HTMLVideoElement) => {
        let vol = 0;
        video.volume = 0;
        const interval = setInterval(() => {
            vol += 0.1;
            if (vol >= 1) {
                vol = 1;
                clearInterval(interval);
            }
            video.volume = vol;
        }, 50); // 500ms fade in
    };

    const fadeOut = (video: HTMLVideoElement) => {
        let vol = video.volume;
        const interval = setInterval(() => {
            vol -= 0.1;
            if (vol <= 0) {
                vol = 0;
                clearInterval(interval);
            }
            video.volume = vol;
        }, 50); // 500ms fade out
    };

    const handleTransition = async () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const currentIdx = indexRef.current;
        const nextIndex = currentIdx + 1;
        
        if (nextIndex >= completedShots.length) {
            // End of movie
            return;
        }

        const currentActive = activePlayerRef.current;
        const nextActive = currentActive === 1 ? 2 : 1;
        
        const nextVideo = nextActive === 1 ? video1Ref.current : video2Ref.current;
        const currentVideo = currentActive === 1 ? video1Ref.current : video2Ref.current;

        if (nextVideo && currentVideo) {
            // 1. Start playing next video (muted for safety)
            nextVideo.volume = 0;
            await nextVideo.play();

            // 2. Wait for it to actually have data
            while (nextVideo.currentTime === 0) {
                await new Promise(r => requestAnimationFrame(r));
            }

            // 3. Switch Visibility (Cut)
            setActivePlayer(nextActive);
            activePlayerRef.current = nextActive; // Update Ref
            
            setCurrentIndex(nextIndex);
            indexRef.current = nextIndex; // Update Ref
            
            // 4. Audio Crossfade Logic
            fadeIn(nextVideo); 
            // Current video is already fading out from the loop check, just stop it
            currentVideo.pause();

            // 5. Preload Future Shot
            const futureIndex = nextIndex + 1;
            if (futureIndex < completedShots.length) {
                currentVideo.src = completedShots[futureIndex].videoUrl || '';
                currentVideo.load();
            }
        }

        // Resume loop
        requestRef.current = requestAnimationFrame(checkProgress);
    };

    const checkProgress = () => {
        // Use Refs to get fresh state inside the loop
        const activeP = activePlayerRef.current;
        const activeVideo = activeP === 1 ? video1Ref.current : video2Ref.current;

        if (activeVideo && !activeVideo.paused) {
            const timeLeft = activeVideo.duration - activeVideo.currentTime;

            // Trigger Fade Out near end
            if (timeLeft < 0.6 && activeVideo.volume > 0.8) { // Only trigger once
                fadeOut(activeVideo);
            }

            // Trigger Transition slightly before end to prevent gaps
            if (timeLeft < 0.1) {
               handleTransition();
               return; // Don't loop this frame, transition handles next steps
            }
        }
        requestRef.current = requestAnimationFrame(checkProgress);
    };

    // Initial Load
    useEffect(() => {
        if (completedShots.length === 0) return;
        
        // Setup Player 1
        if (video1Ref.current) {
            video1Ref.current.src = completedShots[0].videoUrl || '';
            video1Ref.current.volume = 0; // Start silent for fade-in
            video1Ref.current.play().then(() => {
                fadeIn(video1Ref.current!);
            }).catch(e => console.log("Autoplay blocked", e));
        }
        
        // Preload Player 2
        if (completedShots.length > 1 && video2Ref.current) {
            video2Ref.current.src = completedShots[1].videoUrl || '';
            video2Ref.current.load();
        }

        // Start Loop
        requestRef.current = requestAnimationFrame(checkProgress);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            {/* Controls Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-[110] pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4">
                     <button 
                        onClick={onDownload}
                        className="bg-white/10 hover:bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all"
                     >
                         <ArrowDownOnSquareIcon className="w-4 h-4" /> Download Full Movie
                     </button>
                </div>
                <button 
                    onClick={onClose}
                    className="pointer-events-auto text-white/50 hover:text-white transition-colors"
                >
                    <XMarkIcon className="w-10 h-10" />
                </button>
            </div>

            <div className="w-full max-w-6xl aspect-video bg-black relative shadow-2xl overflow-hidden group">
                <video 
                    ref={video1Ref}
                    className={`absolute inset-0 w-full h-full object-contain bg-black ${activePlayer === 1 ? 'z-20 visible' : 'z-10 invisible'}`}
                    playsInline
                />
                <video 
                    ref={video2Ref}
                    className={`absolute inset-0 w-full h-full object-contain bg-black ${activePlayer === 2 ? 'z-20 visible' : 'z-10 invisible'}`}
                    playsInline
                />

                {/* Info Overlay */}
                <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                     <p className="text-white/50 text-sm font-mono uppercase tracking-[0.3em] shadow-black drop-shadow-md">
                        Shot {completedShots[currentIndex]?.id} / {completedShots.length}
                     </p>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [step, setStep] = useState<'setup' | 'production'>('setup');
  
  // Story State
  const [outline, setOutline] = useState('');
  const [style, setStyle] = useState('');
  const [audioStyle, setAudioStyle] = useState(''); // Global Audio Style
  const [referenceImages, setReferenceImages] = useState<AnnotatedImage[]>([]); 
  const [shots, setShots] = useState<Shot[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessText, setCurrentProcessText] = useState('');
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Movie Player State
  const [isPlayingMovie, setIsPlayingMovie] = useState(false);
  const [renderProgress, setRenderProgress] = useState('');

  // Check API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (shots.length > 0 && !isPlayingMovie) {
      timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [shots.length, isProcessing, isPlayingMovie]);

  // --- Image Handling ---

  const handleGlobalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remainingSlots = 3 - referenceImages.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setReferenceImages(prev => [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                url: reader.result as string,
                label: "Reference Style" 
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const updateGlobalImageLabel = (index: number, label: string) => {
    setReferenceImages(prev => prev.map((img, i) => i === index ? { ...img, label } : img));
  };

  const removeGlobalImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleShotImageUpload = (shotId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const shot = shots.find(s => s.id === shotId);
      if (!shot) return;
      
      const currentCount = shot.shotReferenceImages.length;
      const remainingSlots = 3 - currentCount; 
      const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            const newImg: AnnotatedImage = {
                id: Math.random().toString(36).substr(2, 9),
                url: reader.result as string,
                label: "Use for this shot"
            };
            setShots(prev => prev.map(s => 
              s.id === shotId 
                ? { ...s, shotReferenceImages: [...s.shotReferenceImages, newImg] }
                : s
            ));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const updateShotImageLabel = (shotId: number, imgIndex: number, label: string) => {
    setShots(prev => prev.map(s => 
        s.id === shotId 
          ? { 
              ...s, 
              shotReferenceImages: s.shotReferenceImages.map((img, i) => i === imgIndex ? { ...img, label } : img) 
            }
          : s
      ));
  }

  const removeShotImage = (shotId: number, index: number) => {
    setShots(prev => prev.map(s => 
      s.id === shotId 
        ? { ...s, shotReferenceImages: s.shotReferenceImages.filter((_, i) => i !== index) }
        : s
    ));
  };

  // --- Video & Frame Utilities ---

  const captureLastFrame = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.currentTime = Math.max(0, video.duration - 0.1); 
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } else {
            reject(new Error("Could not get canvas context"));
          }
        } catch (e) {
          reject(e);
        }
      };

      video.onerror = (e) => reject(new Error("Error loading video for frame capture"));
    });
  };

  const handleDownloadFullMovie = async () => {
      await renderAndDownloadMovie(shots, setRenderProgress);
  };

  // --- Production Logic ---

  const startProduction = () => {
    if (!outline || !style) return;
    setStep('production');
    prepareNextShot();
  };

  const prepareNextShot = async () => {
    setIsProcessing(true);
    const shotNumber = shots.length + 1;
    setCurrentProcessText(`Directing Shot #${shotNumber}...`);
    
    let previousFrameUrl: string | undefined;

    // Capture from last completed shot only
    const completedShots = shots.filter(s => s.status === 'completed');
    if (completedShots.length > 0) {
      const lastShot = completedShots[completedShots.length - 1];
      if (lastShot.videoUrl) {
        try {
          previousFrameUrl = await captureLastFrame(lastShot.videoUrl);
        } catch (e) {
          console.warn("Could not capture last frame:", e);
        }
      }
    }

    try {
      // Pass audioStyle to generation
      const details: GeminiShotResponse = await generateShotDetails(outline, style, audioStyle || 'Cinematic', shotNumber, shots);
      
      const newShot: Shot = {
        id: shotNumber,
        description: details.reasoning,
        action: details.action,
        camera: details.camera,
        mood: details.mood,
        audio: details.audio, // Store Generated Audio Prompt
        dialogue: details.dialogue,
        visualPrompt: details.visual_prompt,
        status: 'draft',
        shotReferenceImages: [], 
        previousFrameUrl,
        usePreviousFrame: !!previousFrameUrl,
        isEditing: true // Default to editing for new drafts
      };
      
      setShots(prev => [...prev, newShot]);
    } catch (error) {
      console.error(error);
      alert("Failed to generate shot details. Please try again.");
    } finally {
      setIsProcessing(false);
      setCurrentProcessText('');
    }
  };

  const handleUpdateShot = (id: number, field: keyof Shot, value: any) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const toggleEditShot = (id: number) => {
     setShots(prev => prev.map(s => s.id === id ? { ...s, isEditing: !s.isEditing } : s));
  };

  const handleGenerateVideo = async (shotId: number) => {
    const shotIndex = shots.findIndex(s => s.id === shotId);
    if (shotIndex === -1) return;

    const shot = shots[shotIndex];
    setIsProcessing(true);
    
    // Set status to generating and exit edit mode
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'generating_video', isEditing: false, error: undefined } : s));
    
    setCurrentProcessText(`Filming Shot #${shotId} with Veo 3...`);

    try {
      const startFrame = shot.usePreviousFrame ? shot.previousFrameUrl : undefined;
      const allRefs = [...shot.shotReferenceImages, ...referenceImages];
      const uniqueRefs = allRefs.filter((v,i,a)=>a.findIndex(v2=>(v2.url===v.url))===i);
      const finalRefs = uniqueRefs.slice(0, 3); 

      // Pass Audio Prompt to generation service
      const videoUrl = await generateVideo(shot.visualPrompt, shot.audio, startFrame, finalRefs);

      setShots(prev => prev.map(s => s.id === shotId ? {
        ...s,
        videoUrl,
        status: 'completed'
      } : s));

    } catch (error) {
      console.error(error);
      
      let errorMessage = error instanceof Error ? error.message : "Failed to generate video";
      // Handle Rate Limit Error gracefully in UI
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = "Usage limit exceeded. Please wait 60 seconds and try again.";
      }

      setShots(prev => prev.map(s => s.id === shotId ? {
        ...s,
        status: 'error',
        isEditing: true, 
        error: errorMessage
      } : s));
    } finally {
      setIsProcessing(false);
      setCurrentProcessText('');
    }
  };

  // --- Render ---

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white text-center">
        <FilmIcon className="w-24 h-24 text-indigo-500 mb-6" />
        <h1 className="text-4xl font-bold mb-4">8-Second Story Movie Builder</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          Create short films beat by beat using Gemini 3 Pro for direction and Veo 3 for video generation. 
          Please select a paid API key to begin.
        </p>
        <button 
          onClick={handleSelectKey}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105"
        >
          Select API Key
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500 selection:text-white relative">
      
      {/* Movie Player & Renderer Overlay */}
      {isPlayingMovie && (
          <SeamlessPlayer 
            shots={shots} 
            onClose={() => setIsPlayingMovie(false)} 
            onDownload={handleDownloadFullMovie}
          />
      )}

      {/* Render Progress Modal */}
      {renderProgress && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-gray-900 p-8 rounded-2xl border border-indigo-500/30 flex flex-col items-center gap-4 animate-bounce-in">
                  <Spinner size="lg" className="text-indigo-500" />
                  <p className="text-xl font-bold text-white">{renderProgress}</p>
                  <p className="text-sm text-gray-400">Processing high-quality video & audio stitching...</p>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilmIcon className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight">8-Second Story</h1>
          </div>
          {step === 'production' && (
             <div className="flex items-center gap-4">
                 <div className="text-sm text-gray-400 font-mono hidden sm:block">
                   {shots.filter(s => s.status === 'completed').length} Shot(s) Completed
                 </div>
                 {shots.some(s => s.status === 'completed') && (
                     <button 
                        onClick={() => setIsPlayingMovie(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
                     >
                         <PlayIcon className="w-3 h-3" /> Watch Movie
                     </button>
                 )}
             </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-40">
        {step === 'setup' ? (
          <div className="max-w-2xl mx-auto mt-10 animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 text-center">Pre-Production</h2>
            
            <div className="bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-800 space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Global Story Outline</label>
                <textarea 
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  placeholder="e.g., A lonely robot discovers a flower in a cyberpunk wasteland..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none h-32 resize-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Visual Style</label>
                    <input 
                      type="text"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="e.g., Blade Runner 2049, neon noir"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Audio/Soundtrack Style</label>
                    <input 
                      type="text"
                      value={audioStyle}
                      onChange={(e) => setAudioStyle(e.target.value)}
                      placeholder="e.g., Industrial hum, Synthwave, Rain"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Global Reference Images <span className="text-gray-500">- Max 3</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {referenceImages.map((img, idx) => (
                    <div key={img.id} className="relative bg-black rounded-lg p-2 border border-gray-700 group">
                      <div className="aspect-video w-full overflow-hidden rounded mb-2">
                          <img src={img.url} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                      </div>
                      <input 
                        type="text"
                        value={img.label}
                        onChange={(e) => updateGlobalImageLabel(idx, e.target.value)}
                        placeholder="Use for..."
                        className="w-full bg-gray-800 text-xs border border-gray-600 rounded px-2 py-1 text-gray-300 focus:border-indigo-500 outline-none"
                      />
                      <button 
                        onClick={() => removeGlobalImage(idx)}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {referenceImages.length < 3 && (
                    <div className="relative aspect-video">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleGlobalImageUpload}
                        className="hidden"
                        id="ref-upload"
                        multiple
                      />
                      <label 
                        htmlFor="ref-upload"
                        className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-gray-800 transition-all"
                      >
                        <PhotoIcon className="w-8 h-8 text-gray-500 mb-2" />
                        <span className="text-xs text-gray-400">Add Image</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={startProduction}
                disabled={!outline || !style}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${(!outline || !style) ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transform active:scale-95'}`}
              >
                <SparklesIcon className="w-6 h-6" />
                Start Production
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {shots.map((shot, index) => (
              <div key={shot.id} className={`bg-gray-900 rounded-2xl border ${shot.status === 'draft' || shot.isEditing ? 'border-indigo-500/50 shadow-indigo-500/10' : 'border-gray-800'} overflow-hidden shadow-2xl transition-all duration-500`}>
                {/* Shot Header */}
                <div className="bg-gray-800/50 p-4 border-b border-gray-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${shot.status === 'draft' || shot.isEditing ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                      {shot.id}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-200">Shot #{shot.id}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                      {shot.status === 'completed' && !shot.isEditing && (
                          <button 
                            onClick={() => toggleEditShot(shot.id)}
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                          >
                              <PencilSquareIcon className="w-3 h-3" /> Edit / Regenerate
                          </button>
                      )}
                      <div className={`text-xs font-mono px-3 py-1 rounded-full uppercase tracking-wider ${
                        shot.status === 'completed' ? 'bg-green-900/30 text-green-400' : 
                        shot.status === 'error' ? 'bg-red-900/30 text-red-400' :
                        (shot.status === 'draft' || shot.isEditing) ? 'bg-indigo-900/30 text-indigo-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {shot.isEditing ? 'EDITING' : shot.status.replace('_', ' ')}
                      </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Script / Details Area */}
                  <div className="space-y-6">
                    {(shot.status === 'draft' || shot.isEditing) ? (
                      // EDIT MODE
                      <div className="space-y-6 bg-gray-900/50 rounded-xl p-3">
                        
                        {/* Prompt Editing */}
                        <div className="space-y-3">
                            <div>
                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400 mb-2 font-bold">
                                    <PencilSquareIcon className="w-4 h-4" /> Action (Story)
                                </label>
                                <textarea 
                                    value={shot.action}
                                    onChange={(e) => handleUpdateShot(shot.id, 'action', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none h-20"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400 mb-2 font-bold">
                                    <MusicalNoteIcon className="w-4 h-4" /> Sound Design
                                </label>
                                <textarea 
                                    value={shot.audio}
                                    onChange={(e) => handleUpdateShot(shot.id, 'audio', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none h-20"
                                    placeholder="Describe music, SFX, ambience..."
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400 mb-2 font-bold">
                                    <PencilSquareIcon className="w-4 h-4" /> Visual Prompt (Veo)
                                </label>
                                <textarea 
                                    value={shot.visualPrompt}
                                    onChange={(e) => handleUpdateShot(shot.id, 'visualPrompt', e.target.value)}
                                    className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-gray-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none h-24"
                                />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <input 
                                    value={shot.camera}
                                    onChange={(e) => handleUpdateShot(shot.id, 'camera', e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300"
                                    placeholder="Camera..."
                                />
                                <input 
                                    value={shot.mood}
                                    onChange={(e) => handleUpdateShot(shot.id, 'mood', e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300"
                                    placeholder="Mood..."
                                />
                            </div>
                        </div>

                        {/* Continuity & Reference Images */}
                        <div className="border-t border-gray-700 pt-4 space-y-4">
                            {/* Previous Frame (Continuity) */}
                            {shot.previousFrameUrl && (
                                <div>
                                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400 mb-2 font-bold cursor-pointer w-fit">
                                        <input 
                                          type="checkbox"
                                          checked={shot.usePreviousFrame}
                                          onChange={(e) => handleUpdateShot(shot.id, 'usePreviousFrame', e.target.checked)}
                                          className="form-checkbox h-4 w-4 text-indigo-600 rounded bg-gray-800 border-gray-600 focus:ring-indigo-500"
                                        />
                                        <LinkIcon className="w-4 h-4" /> 
                                        Continue from Previous Frame
                                    </label>
                                    
                                    {shot.usePreviousFrame && (
                                        <div className="relative w-40 aspect-video rounded-lg overflow-hidden border border-indigo-500/50 shadow-lg mt-1">
                                            <img src={shot.previousFrameUrl} alt="Prev Frame" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-indigo-900/10 pointer-events-none"></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Shot Specific Reference Images */}
                            <div>
                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-400 mb-2 font-bold">
                                    <PhotoIcon className="w-4 h-4" /> Shot References
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                     {shot.shotReferenceImages.map((img, idx) => (
                                        <div key={img.id} className="relative bg-black rounded p-2 border border-gray-600 group">
                                            <div className="aspect-video w-full overflow-hidden rounded mb-1">
                                                <img src={img.url} alt="Shot Ref" className="w-full h-full object-cover" />
                                            </div>
                                            <input 
                                                type="text"
                                                value={img.label}
                                                onChange={(e) => updateShotImageLabel(shot.id, idx, e.target.value)}
                                                placeholder="Use for..."
                                                className="w-full bg-gray-800 text-[10px] border border-gray-600 rounded px-1 py-0.5 text-gray-300 focus:border-indigo-500 outline-none"
                                            />
                                            <button 
                                                onClick={() => removeShotImage(shot.id, idx)}
                                                className="absolute top-0 right-0 bg-red-500/80 p-1 text-white opacity-0 group-hover:opacity-100 rounded-bl"
                                            >
                                                <XMarkIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                     ))}
                                     {shot.shotReferenceImages.length < 3 && (
                                         <label className="flex items-center justify-center border border-dashed border-gray-600 rounded min-h-[100px] cursor-pointer hover:bg-gray-800">
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleShotImageUpload(shot.id, e)} />
                                            <span className="text-gray-500 text-xs">+ Ref</span>
                                         </label>
                                     )}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Specify how Veo should use these images (e.g., "Use for lighting").
                                </p>
                            </div>
                        </div>

                      </div>
                    ) : (
                      // VIEW MODE
                      <>
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Action</h4>
                          <p className="text-gray-300 leading-relaxed text-lg">{shot.action}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 p-3 rounded-lg">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Camera</h4>
                            <p className="text-indigo-300 text-sm font-medium">{shot.camera}</p>
                          </div>
                          <div className="bg-gray-800/50 p-3 rounded-lg">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Mood</h4>
                            <p className="text-indigo-300 text-sm font-medium">{shot.mood}</p>
                          </div>
                        </div>
                        {shot.audio && (
                            <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700">
                                <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
                                    <MusicalNoteIcon className="w-3 h-3" /> Audio
                                </h4>
                                <p className="text-gray-300 text-sm italic">{shot.audio}</p>
                            </div>
                        )}
                        {shot.dialogue && shot.dialogue !== "None" && (
                           <div className="bg-gray-950 p-4 rounded-lg border-l-4 border-indigo-500">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-1">Dialogue</h4>
                              <p className="text-white italic text-sm">"{shot.dialogue}"</p>
                           </div>
                        )}
                        <details className="group pt-2">
                           <summary className="flex items-center cursor-pointer text-xs text-gray-600 hover:text-indigo-400 transition-colors">
                             <span className="mr-2">View Prompt Used</span>
                             <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                           </summary>
                           <div className="mt-2 p-3 bg-black/30 rounded text-xs font-mono text-gray-500">
                             {shot.visualPrompt}
                           </div>
                        </details>
                      </>
                    )}
                  </div>

                  {/* Video Output / Action Area */}
                  <div className="flex flex-col h-full">
                    <div className="flex-1 bg-black/40 rounded-xl min-h-[260px] border border-gray-800 relative overflow-hidden group flex items-center justify-center">
                      {shot.status === 'completed' && shot.videoUrl && !shot.isEditing ? (
                        <>
                          <video 
                            src={shot.videoUrl} 
                            controls 
                            className="w-full h-full object-cover rounded-xl shadow-2xl"
                          />
                          <a 
                             href={shot.videoUrl}
                             download={`shot-${shot.id}.mp4`}
                             className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-indigo-600 text-white rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                             title="Download Video"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                          </a>
                        </>
                      ) : shot.status === 'error' ? (
                        <div className="text-center p-6">
                          <div className="text-red-500 mb-2 font-bold">Generation Failed</div>
                          <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded max-w-xs mx-auto mb-4">{shot.error}</div>
                          <button 
                            onClick={() => handleGenerateVideo(shot.id)} 
                            className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (shot.status === 'draft' || shot.isEditing) ? (
                        <div className="text-center px-6 py-10">
                          <FilmIcon className="w-16 h-16 text-gray-800 mx-auto mb-4" />
                          <p className="text-gray-400 text-sm mb-6">
                            Review the shot details on the left.<br/>
                            Check continuity & references.<br/>
                            {shot.status === 'completed' ? 'Click below to regenerate.' : 'When ready, generate the video.'}
                          </p>
                          <button 
                            onClick={() => handleGenerateVideo(shot.id)}
                            disabled={isProcessing}
                            className={`
                                bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg 
                                shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all transform hover:scale-105 
                                flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                          >
                             {isProcessing ? <Spinner size="sm" /> : <VideoCameraIcon className="w-5 h-5" />}
                             {shot.status === 'completed' ? 'Regenerate Video' : 'Generate Video'}
                          </button>
                          
                          {shot.status === 'completed' && (
                              <button 
                                onClick={() => toggleEditShot(shot.id)}
                                className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline"
                              >
                                  Cancel Edit
                              </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 p-6 text-center animate-pulse">
                            <VideoCameraIcon className="w-12 h-12 text-indigo-500" />
                            <div className="space-y-1">
                              <p className="text-indigo-300 font-medium text-lg">Filming on Set...</p>
                              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                                Using Veo 3. 
                                {shot.usePreviousFrame && " Ensuring continuity from previous shot..."}
                              </p>
                            </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div ref={timelineEndRef} className="h-24" />

            {/* Sticky Action Bar */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-xl px-4">
              {shots.length > 0 && shots[shots.length-1]?.status === 'completed' && !shots[shots.length-1]?.isEditing && (
                 <div className="bg-gray-800/90 backdrop-blur-md p-2 rounded-full shadow-2xl border border-gray-700 flex items-center gap-2 pr-2 animate-bounce-in">
                   <div className="flex-1 px-6 text-sm text-gray-300">
                     {isProcessing ? (
                       <span className="flex items-center gap-2">
                          <Spinner size="sm" className="text-indigo-400" />
                          {currentProcessText}
                       </span>
                     ) : (
                       "Scene complete. Ready for next?"
                     )}
                   </div>
                   <button 
                     onClick={prepareNextShot}
                     disabled={isProcessing}
                     className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${
                       isProcessing 
                         ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                         : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-105'
                     }`}
                   >
                     {isProcessing ? 'Thinking...' : 'Next 8 Seconds'}
                     {!isProcessing && <ArrowRightIcon className="w-4 h-4" />}
                   </button>
                 </div>
              )}
              {isProcessing && (shots.length === 0 || shots[shots.length-1]?.status !== 'completed' || shots.some(s=>s.isEditing && s.status === 'generating_video')) && (
                  <div className="bg-black/80 backdrop-blur rounded-full px-6 py-3 text-sm text-white flex items-center justify-center gap-3 shadow-xl mx-auto w-fit border border-gray-800">
                     <Spinner size="sm" className="text-indigo-400" />
                     {currentProcessText}
                  </div>
              )}
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
};

export default App;