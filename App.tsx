import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Home, Wand2, X, Zap, Sparkles, StopCircle, Delete, Eraser, Check, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { VOCABULARY } from './constants';
import { AACSymbol, NodeType } from './types';
import { naturalizeSentence, generateSpeech, playAudioBuffer, predictNextSymbols } from './services/geminiService';
import { useEyeTracking } from './hooks/useEyeTracking';
import { GazeCursor } from './components/GazeCursor';

// --- WAV ENCODER HELPERS ---

const encodeWAV = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
};

const flattenAudioChunks = (chunks: Float32Array[]) => {
  const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

// --- HELPERS ---
const findSymbolById = (id: string, list: AACSymbol[]): AACSymbol | undefined => {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findSymbolById(id, item.children);
      if (found) return found;
    }
  }
  return undefined;
};

// --- COMPONENTS ---

const IconCard: React.FC<{
  symbol: AACSymbol;
  onClick: (symbol: AACSymbol) => void;
  isSuggested?: boolean;
  isGazedAt?: boolean;
}> = ({ symbol, onClick, isSuggested, isGazedAt }) => {
  return (
    <button
      data-symbol-id={symbol.id}
      onClick={() => onClick(symbol)}
      className={`
        relative flex flex-col items-center justify-center 
        aspect-square w-full p-2 rounded-3xl 
        transition-all duration-200 select-none
        ${isSuggested
          ? 'scale-105 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.2)] ring-4 ring-indigo-200 z-10'
          : 'hover:scale-105 shadow-[0_4px_0_0_rgba(0,0,0,0.1)] hover:shadow-lg'
        }
        ${isGazedAt ? 'ring-4 ring-green-400 scale-110' : ''}
        border-b-4 active:border-b-0 active:translate-y-1
        ${symbol.color}
      `}
    >
      {isSuggested && (
        <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center animate-bounce">
          <Sparkles size={10} className="mr-1" /> Pick
        </div>
      )}
      <span className="text-5xl md:text-6xl lg:text-7xl mb-3 drop-shadow-sm filter">
        {symbol.emoji}
      </span>
      <span className="text-sm md:text-base font-extrabold text-slate-700 leading-tight text-center px-1">
        {symbol.label}
      </span>
    </button>
  );
};

const AudioVisualizer: React.FC<{ analyser: AnalyserNode | null, isRecording: boolean }> = ({ analyser, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isRecording || !analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 20;
      const barWidth = (canvas.width / barCount) - 2;
      const step = Math.floor(bufferLength / barCount / 2);

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[(i * step) + j];
        }
        const average = sum / step;
        const percent = average / 255;
        const height = Math.max(percent * canvas.height, 4);
        const x = i * (barWidth + 2);
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = `rgba(99, 102, 241, ${Math.max(0.4, percent)})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 4);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, isRecording]);

  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100 animate-fade-in">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      <canvas ref={canvasRef} width={120} height={24} />
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [view, setView] = useState<'landing' | 'board'>('landing');
  const [currentCategory, setCurrentCategory] = useState<AACSymbol | null>(null);
  const [sentence, setSentence] = useState<AACSymbol[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedSentence, setGeneratedSentence] = useState<string>('');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Audio Recording Refs (WAV)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false); // Ref for processor closure access

  const [manualSuggestions, setManualSuggestions] = useState<AACSymbol[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AACSymbol[]>([]);

  // Swipe/Drag Refs (for both touch and mouse)
  const startXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Eye Tracking State
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(false);
  const { gazePosition, hoveredElement, isInitialized } = useEyeTracking(eyeTrackingEnabled, 2000);

  // --- RECORDING LOGIC (WAV) ---

  const startBackgroundRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Visualizer Analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;

      // Script Processor for Raw Data (WAV)
      // bufferSize 4096 is a good balance for UI responsiveness vs callback frequency
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      audioChunksRef.current = []; // Reset chunks
      isRecordingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Clone the data because input buffer is reused
        audioChunksRef.current.push(new Float32Array(inputData));
      };

      // Create a mute gain node to prevent feedback loop but keep the graph active
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;

      // Connect graph: Source -> Analyser -> Processor -> Gain -> Dest
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      analyserRef.current = analyser;

      setIsRecording(true);
      setView('board');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setView('board');
    }
  };

  const stopRecordingAndGetBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!isRecordingRef.current) {
        resolve(audioBlob);
        return;
      }

      isRecordingRef.current = false;
      setIsRecording(false);

      // Cleanup audio nodes
      if (sourceRef.current) sourceRef.current.disconnect();
      if (processorRef.current) processorRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());

      // Process WAV
      if (audioContextRef.current && audioChunksRef.current.length > 0) {
        const flattened = flattenAudioChunks(audioChunksRef.current);
        const wavBlob = encodeWAV(flattened, audioContextRef.current.sampleRate);

        setAudioBlob(wavBlob);

        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }

        resolve(wavBlob);
      } else {
        resolve(null);
      }
    });
  };

  // --- AI PREDICTION EFFECT ---

  useEffect(() => {
    if (sentence.length === 0) {
      setAiSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const labels = sentence.map(s => s.label);
      const predictedIds = await predictNextSymbols(labels);

      const newAiSuggestions: AACSymbol[] = [];
      predictedIds.forEach(id => {
        const found = findSymbolById(id, VOCABULARY);
        if (found) newAiSuggestions.push(found);
      });
      setAiSuggestions(newAiSuggestions);
    }, 600);

    return () => clearTimeout(timer);
  }, [sentence]);


  // --- SYMBOL LOGIC ---

  const handleSymbolClick = (symbol: AACSymbol) => {
    if (symbol.type === NodeType.CATEGORY) {
      setCurrentCategory(symbol);
      setManualSuggestions([]);
    } else {
      setSentence(prev => [...prev, symbol]);
      if (symbol.relatedIds && symbol.relatedIds.length > 0) {
        const suggestions: AACSymbol[] = [];
        symbol.relatedIds.forEach(id => {
          const found = findSymbolById(id, VOCABULARY);
          if (found) suggestions.push(found);
        });
        setManualSuggestions(suggestions);
      } else {
        setManualSuggestions([]);
      }
    }
  };

  const goBack = () => {
    setCurrentCategory(null);
    setManualSuggestions([]);
  };

  // --- SWIPE/DRAG HANDLERS (Touch + Mouse) ---

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!currentCategory) return;
    startXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!currentCategory) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - startXRef.current;

    // Swipe Right to go Back (threshold: 80px)
    if (diff > 80) {
      goBack();
    }
  };

  // Mouse handlers (for trackpad/mouse on Mac)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentCategory) return;
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!currentCategory || !isDraggingRef.current) return;

    const currentX = e.clientX;
    const diff = currentX - startXRef.current;

    // Visual feedback: could add a slide indicator here if needed
    // For now, just track the movement
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!currentCategory || !isDraggingRef.current) return;

    const endX = e.clientX;
    const diff = endX - startXRef.current;

    isDraggingRef.current = false;

    // Swipe Right to go Back (threshold: 80px)
    if (diff > 80) {
      goBack();
    }
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
  };

  const removeFromSentence = (index: number) => {
    const newSentence = [...sentence];
    newSentence.splice(index, 1);
    setSentence(newSentence);
    setGeneratedSentence('');
  };

  const handleBackspace = () => {
    if (sentence.length === 0) return;
    const newSentence = [...sentence];
    newSentence.pop();
    setSentence(newSentence);
    setGeneratedSentence('');
  };

  const clearSentence = () => {
    setSentence([]);
    setGeneratedSentence('');
    setManualSuggestions([]);
    setAiSuggestions([]);
    setAudioBlob(null);
  };

  // --- GENERATION LOGIC ---

  const handleSpeak = async () => {
    if (sentence.length === 0) return;

    setIsProcessing(true);

    // 1. Stop recording and get WAV blob
    const blob = await stopRecordingAndGetBlob();

    // 2. Naturalize Sentence using Gemini (Text + Audio)
    const labels = sentence.map(s => s.label);
    const naturalText = await naturalizeSentence(labels, blob);
    setGeneratedSentence(naturalText);

    // 3. Generate Audio using Gemini TTS
    const audioBuffer = await generateSpeech(naturalText);

    if (audioBuffer) {
      await playAudioBuffer(audioBuffer);
    } else {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(naturalText);
      synth.speak(utterance);
    }

    setIsProcessing(false);
  };

  // --- RENDER: LANDING ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#f0f4f8]">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

        <div className="z-10 flex flex-col items-center text-center space-y-12 max-w-md w-full">
          <div>
            <h1 className="text-6xl font-black text-slate-800 mb-2 tracking-tight">Amplify</h1>
            <p className="text-xl text-slate-500 font-semibold">Voice for everyone.</p>
          </div>

          <button
            onClick={startBackgroundRecording}
            className="group relative flex items-center justify-center w-64 h-64 rounded-full bg-white shadow-[0_20px_50px_rgba(99,102,241,0.3)] transition-transform hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-20"></div>
            <Mic size={100} className="text-indigo-600 drop-shadow-sm group-hover:text-indigo-700 transition-colors" />
            <div className="absolute bottom-10 text-indigo-400 font-bold text-sm uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
              Tap to Start
            </div>
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: BOARD ---

  const combinedSuggestionsMap = new Map<string, AACSymbol>();
  manualSuggestions.forEach(item => combinedSuggestionsMap.set(item.id, item));
  aiSuggestions.forEach(item => combinedSuggestionsMap.set(item.id, item));
  const finalSuggestions = Array.from(combinedSuggestionsMap.values());

  const itemsDisplay = currentCategory ? (currentCategory.children || []) : VOCABULARY;

  return (
    <div
      className="min-h-screen w-full bg-slate-50 flex flex-col font-nunito touch-pan-y select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ overscrollBehaviorX: 'none', cursor: currentCategory && isDraggingRef.current ? 'grabbing' : 'default' }}
    >
      {/* TOP BAR */}
      <div className="bg-white shadow-lg sticky top-0 z-30 p-4 rounded-b-3xl">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setView('landing')} className="text-slate-400 hover:text-slate-600 transition-colors" title="Home">
                <Home size={24} />
              </button>
              {currentCategory && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl transition-colors font-bold"
                  title="Go Back"
                >
                  <ArrowLeft size={20} />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isRecording && (
                <AudioVisualizer analyser={analyserRef.current} isRecording={isRecording} />
              )}
              <h1 className="font-black text-xl text-slate-700 tracking-tight hidden sm:block">Amplify</h1>
            </div>
            <button
              onClick={() => setEyeTrackingEnabled(!eyeTrackingEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold ${eyeTrackingEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              title={eyeTrackingEnabled ? 'Disable Eye Tracking' : 'Enable Eye Tracking'}
            >
              {eyeTrackingEnabled ? <Eye size={20} /> : <EyeOff size={20} />}
              <span className="hidden md:inline">{eyeTrackingEnabled ? 'Eye On' : 'Eye Off'}</span>
            </button>
          </div>

          {/* Sentence Strip */}
          <div className="min-h-[110px] bg-slate-100 rounded-2xl border-2 border-slate-200 flex items-center p-3 overflow-x-auto gap-3 no-scrollbar">
            {sentence.length === 0 && (
              <div className="w-full text-center text-slate-400 font-semibold italic opacity-60">
                Select items to build sentence...
              </div>
            )}
            {sentence.map((s, idx) => (
              <div key={`${s.id}-${idx}`} className="flex-shrink-0 relative group animate-fade-in-up">
                <div className={`flex flex-col items-center justify-center w-20 h-20 ${s.color} rounded-2xl border-b-4 shadow-sm`}>
                  <span className="text-3xl">{s.emoji}</span>
                  <span className="text-[10px] font-bold truncate max-w-[70px] uppercase tracking-wide text-slate-700 mt-1">{s.label}</span>
                </div>
                <button
                  onClick={() => removeFromSentence(idx)}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity scale-75 hover:scale-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Generated Text & Controls */}
          <div className="space-y-3">
            {generatedSentence && (
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center text-indigo-700 font-bold text-lg animate-fade-in">
                "{generatedSentence}"
              </div>
            )}

            <div className="flex gap-3">
              {/* New Sentence / Done Button */}
              <button
                onClick={clearSentence}
                className="px-4 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 transition-colors flex items-center justify-center gap-2 font-bold"
                title="Start New Sentence"
              >
                <Check size={24} />
                <span className="hidden sm:inline">Done</span>
              </button>

              <button
                onClick={handleBackspace}
                disabled={sentence.length === 0}
                className="px-5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-600 border border-orange-200 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Backspace"
              >
                <Delete size={24} />
              </button>

              {/* Speak / Action */}
              <button
                onClick={handleSpeak}
                disabled={sentence.length === 0 || isProcessing}
                className={`
                  flex-1 py-4 rounded-xl font-bold text-white text-lg shadow-lg shadow-indigo-200
                  flex items-center justify-center gap-3 transition-all transform active:scale-95
                  ${isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110'}
                `}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 size={24} fill="currentColor" className="text-white/20" />
                    Amplify Voice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 p-4 pb-24 max-w-5xl mx-auto w-full">

        {/* Category Header */}
        {currentCategory && (
          <div className="flex items-center gap-4 mb-6 animate-fade-in">
            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl ${currentCategory.color} border-2 border-black/5 flex-1 shadow-sm`}>
              <span className="text-2xl">{currentCategory.emoji}</span>
              <h2 className="text-xl font-black text-slate-800">{currentCategory.label}</h2>
            </div>
            <div className="text-slate-300 text-sm font-bold uppercase tracking-widest animate-pulse hidden md:block">
              &larr; Swipe to Back
            </div>
          </div>
        )}

        {/* Smart AI Suggestions Area */}
        {finalSuggestions.length > 0 && (
          <div className="mb-6 animate-fade-in-up">
            <div className="flex items-center gap-2 text-indigo-500 text-sm font-bold uppercase tracking-wider mb-3">
              <Sparkles size={16} className="text-indigo-500" />
              Suggested Next
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {finalSuggestions.map(item => (
                <IconCard
                  key={`sugg-${item.id}`}
                  symbol={item}
                  onClick={handleSymbolClick}
                  isSuggested={true}
                  isGazedAt={hoveredElement === item.id}
                />
              ))}
            </div>
            <div className="h-1 w-full bg-slate-200 rounded-full mt-6 mb-2"></div>
          </div>
        )}

        {/* Standard Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {itemsDisplay.map((item) => (
            <IconCard
              key={item.id}
              symbol={item}
              onClick={handleSymbolClick}
              isGazedAt={hoveredElement === item.id}
            />
          ))}
        </div>
      </div>

      {/* Gaze Cursor Overlay */}
      <GazeCursor gazePosition={gazePosition} enabled={eyeTrackingEnabled} />

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}