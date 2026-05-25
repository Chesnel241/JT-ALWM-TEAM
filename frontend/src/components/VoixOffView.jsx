import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Play, AlertCircle } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import { formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function VoixOffView({ countries, selectedWeek, weeks, setSelectedWeek }) {
  const { addToast } = useToast();
  const { lang } = useI18n();
  
  // Exclude _subscriptions and mj if needed, or keep them. Let's keep all except _subscriptions
  const selectableCountries = countries.filter(c => c.id !== '_subscriptions');

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [reportageTitle, setReportageTitle] = useState('');
  const [script, setScript] = useState('');
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Refs for Web Audio API & MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const requestRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      stopVisualizer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [audioUrl]);

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') return;
      requestRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        
        // Neon red/orange gradient
        const r = barHeight + (25 * (i / bufferLength));
        const g = 50 * (i / bufferLength);
        const b = 50;
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        
        x += barWidth + 1;
      }
    };
    
    draw();
  };

  const stopVisualizer = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const startRecording = async () => {
    if (!selectedCountry) {
      return addToast('Veuillez sélectionner un pays d\'abord.', 'error');
    }
    if (!reportageTitle.trim()) {
      return addToast('Le titre du reportage est obligatoire.', 'error');
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Visualizer
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Setup Recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorderRef.current.mimeType || '';
        const blob = new Blob(audioChunksRef.current, mimeType ? { type: mimeType } : undefined);
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
      
      // Start Drawing
      setTimeout(drawVisualizer, 100);

    } catch (err) {
      console.error('Audio capture error:', err);
      addToast('Impossible d\'accéder au microphone. Vérifiez vos permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopVisualizer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    }
  };

  const handleUpload = async () => {
    if (!audioBlob || !selectedCountry || !selectedWeek || !reportageTitle.trim()) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, `voix-${Date.now()}.webm`);
    formData.append('reportageTitle', reportageTitle.trim());
    formData.append('script', script);

    try {
      // Use raw fetch with credentials to pass the httpOnly session cookie
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/uploads/voiceover/${selectedWeek}/${selectedCountry.id}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-App-Password': localStorage.getItem('app-password') || '',
          'x-admin-password': localStorage.getItem('app-password') || ''
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors de l\'envoi');
      }
      
      addToast('Voix off traitée et envoyée avec succès !', 'success', 5000);
      
      // Reset form
      setAudioBlob(null);
      setAudioUrl(null);
      setReportageTitle('');
      setScript('');
      
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[color:var(--ink)] flex items-center gap-3 mb-2">
          🎙️ Studio Voix Off
        </h2>
        <p className="text-[color:var(--muted)] mb-6">
          Sélectionnez votre pays, préparez votre texte, et enregistrez. Notre système appliquera une compression de studio professionnelle automatiquement.
        </p>

        {/* --- SÉLECTEUR DE SEMAINE --- */}
        <div className="bg-[var(--paper)] p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[color:var(--ink)]">Semaine d'enregistrement</h3>
          </div>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full sm:w-auto bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            {weeks?.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Country Selection - Horizontal Scroll */}
      <div className="mb-8">
        <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3">1. Sélectionnez le pays</h3>
        <div className="flex overflow-x-auto pb-4 gap-3 snap-x">
          {selectableCountries.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCountry(c)}
              className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                selectedCountry?.id === c.id 
                  ? 'border-[color:var(--accent)] bg-[var(--accent)]/10 text-[color:var(--accent-deep)] ring-2 ring-[color:var(--accent)]/30' 
                  : 'border-[var(--border)] bg-[var(--paper)] text-[color:var(--ink)] hover:border-[color:var(--accent)]'
              }`}
            >
              <CountryAvatar country={c} className="w-6 h-6" />
              <span className="font-semibold whitespace-nowrap">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form & Studio Grid */}
      {selectedCountry && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Form */}
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3">2. Préparation du reportage</h3>
            
            <div>
              <label className="block text-sm font-medium text-[color:var(--ink)] mb-1">Titre du reportage *</label>
              <input 
                type="text" 
                value={reportageTitle}
                onChange={e => setReportageTitle(e.target.value)}
                placeholder="Ex: Élections présidentielles"
                className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--paper)] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              />
            </div>
            
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-[color:var(--ink)] mb-1">Texte (Optionnel - Pour le téléprompteur)</label>
              <textarea 
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Collez votre script ici. Il s'affichera en grand dans le téléprompteur à droite."
                className="w-full flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] resize-y"
              />
            </div>
          </div>

          {/* Right Column: Dark Studio Recording */}
          <div className="bg-[#121212] rounded-3xl p-6 shadow-2xl border border-gray-800 flex flex-col relative overflow-hidden">
            <h3 className="text-sm uppercase tracking-widest text-gray-500 font-mono mb-4 flex items-center justify-between">
              <span>3. Studio d'enregistrement</span>
              {isRecording && (
                <span className="flex items-center gap-2 text-red-500 font-bold">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)]"></span>
                  REC
                </span>
              )}
            </h3>

            {/* Teleprompter Area */}
            <div className="flex-1 bg-black/40 rounded-xl p-6 overflow-y-auto mb-6 border border-gray-800 min-h-[300px] custom-scrollbar">
              {!script.trim() ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                  <Mic size={48} className="opacity-20" />
                  <p className="text-center font-mono">Écrivez votre texte à gauche pour activer le téléprompteur</p>
                </div>
              ) : (
                <div className="text-4xl leading-[1.6] font-semibold text-white tracking-wide">
                  {script.split('\n').map((line, i) => (
                    <p key={i} className="mb-6">{line}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Audio Visualizer */}
            <div className="h-16 mb-6 rounded-lg overflow-hidden bg-black/50 border border-gray-800 relative">
               {!isRecording && !audioUrl && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-mono text-xs">
                    EN ATTENTE DU SIGNAL...
                  </div>
               )}
               <canvas ref={canvasRef} width="800" height="64" className="w-full h-full" />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              
              {audioUrl ? (
                <div className="flex items-center gap-3 w-full">
                  <audio src={audioUrl} controls className="flex-1 h-10 custom-audio" />
                  <button
                    onClick={() => { 
                      setAudioBlob(null); 
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null); 
                    }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Recommencer
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Traitement...' : <><Upload size={18} /> Traiter et Envoyer</>}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    >
                      <Mic size={20} /> Commencer l'enregistrement
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-gray-700"
                    >
                      <Square size={20} className="fill-white" /> Arrêter
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
