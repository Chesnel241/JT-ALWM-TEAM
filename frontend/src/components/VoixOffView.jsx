import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Play, AlertCircle, RefreshCw, Send, CheckCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import { formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari iOS
    'audio/aac',
    'audio/ogg'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
};

export default function VoixOffView({ countries, selectedWeek, weeks, setSelectedWeek }) {
  const { addToast } = useToast();
  const { lang } = useI18n();
  
  const selectableCountries = countries.filter(c => c.id !== '_subscriptions');

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [reportageTitle, setReportageTitle] = useState('');
  const [script, setScript] = useState('');
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mobileFontSize, setMobileFontSize] = useState(18);

  // Refs for Web Audio API & MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const requestRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      setRecordingSeconds(0);
      interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
    if (isStarting || isRecording) return;
    if (!selectedCountry) {
      return addToast('Veuillez sélectionner un pays d\'abord.', 'error');
    }
    if (!reportageTitle.trim()) {
      return addToast('Le titre du reportage est obligatoire.', 'error');
    }
    
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Visualizer
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      // Fix for iOS Safari AudioContext suspension
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Setup Recorder
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const type = mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
      
      // Start Drawing
      setTimeout(drawVisualizer, 100);

    } catch (err) {
      console.error('Audio capture error:', err);
      addToast('Impossible d\'accéder au microphone. Vérifiez vos permissions.', 'error');
    } finally {
      setIsStarting(false);
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
    
    // Determine the correct extension based on Blob type
    const blobType = audioBlob.type || '';
    let ext = 'webm';
    if (blobType.includes('mp4')) ext = 'mp4';
    else if (blobType.includes('ogg')) ext = 'ogg';
    else if (blobType.includes('aac')) ext = 'aac';

    const formData = new FormData();
    formData.append('audio', audioBlob, `voix-${Date.now()}.${ext}`);
    formData.append('reportageTitle', reportageTitle.trim());
    formData.append('script', script);

    try {
      // Use relative URL — Caddy reverse-proxies /api to backend
      const res = await fetch(`/api/uploads/voiceover/${selectedWeek}/${selectedCountry.id}`, {
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      
      {/* ================================================================ */}
      {/* MOBILE VIEW (md:hidden) — DICTAPHONE PRO EXPERIENCE             */}
      {/* ================================================================ */}
      <div className="md:hidden space-y-4 pb-10">
        {/* Top Header */}
        <div className="p-3.5 bg-[var(--paper)] rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-[color:var(--ink)] flex items-center gap-2">
              <span>🎙️ Studio Voix Off</span>
            </h2>
            <span className="text-[10px] font-bold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              Qualité Studio
            </span>
          </div>

          {/* Week Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Semaine</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-xs font-bold rounded-xl px-3 py-1.5 outline-none"
            >
              {weeks?.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. Country Picker (Horizontal Scroll) */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)] px-1">
            1. Choisissez votre pays
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 custom-scrollbar">
            {selectableCountries.map((c) => {
              const isSelected = selectedCountry?.id === c.id;
              return (
                <button
                  key={`mob-voix-${c.id}`}
                  onClick={() => setSelectedCountry(c)}
                  type="button"
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl font-bold text-xs motion-tap active:scale-95 ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30 scale-105'
                      : 'bg-[var(--paper)] text-[color:var(--ink)] border border-[var(--border)]'
                  }`}
                >
                  <CountryAvatar country={c} className="w-5 h-5 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Preparation Form */}
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
            2. Préparation du reportage
          </span>

          <div>
            <label className="block text-xs font-bold text-[color:var(--ink)] mb-1">
              Titre du reportage *
            </label>
            <input
              type="text"
              value={reportageTitle}
              onChange={(e) => setReportageTitle(e.target.value)}
              placeholder="Ex: Élections présidentielles"
              className="w-full px-3.5 py-2.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-xs text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[color:var(--ink)]">
                Script (Téléprompteur)
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMobileFontSize((s) => Math.max(14, s - 2))}
                  className="p-1 text-xs bg-[var(--paper-2)] border border-[var(--border)] rounded-lg"
                  title="Réduire la taille"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  onClick={() => setMobileFontSize((s) => Math.min(28, s + 2))}
                  className="p-1 text-xs bg-[var(--paper-2)] border border-[var(--border)] rounded-lg"
                  title="Agrandir la taille"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Collez ou tapez votre texte ici..."
              style={{ fontSize: `${mobileFontSize}px` }}
              className="w-full p-3.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-2xl text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] leading-relaxed"
            />
          </div>
        </div>

        {/* 3. Dictaphone Pro Recording Card */}
        <div className="p-5 bg-[var(--ink)] text-white rounded-3xl shadow-xl border border-gray-800 space-y-4 text-center">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>3. ENREGISTREMENT</span>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-red-500 font-bold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                REC
              </span>
            )}
          </div>

          {/* Large Live Timer */}
          <div className="py-2">
            <span className="font-mono text-4xl font-black tracking-wider text-white">
              {isRecording ? formatTimer(recordingSeconds) : '00:00'}
            </span>
            <p className="text-[11px] text-gray-400 font-mono mt-1">
              {isRecording ? 'Enregistrement de la voix off...' : 'Prêt à enregistrer'}
            </p>
          </div>

          {/* Canvas visualizer */}
          <div className="h-12 rounded-xl overflow-hidden bg-black/50 border border-gray-800">
            <canvas ref={canvasRef} width="600" height="48" className="w-full h-full" />
          </div>

          {/* Prompter preview if script entered */}
          {script.trim() && isRecording && (
            <div className="p-3 bg-black/60 rounded-2xl border border-gray-700 max-h-36 overflow-y-auto text-left">
              <p
                style={{ fontSize: `${mobileFontSize}px` }}
                className="leading-relaxed text-white font-medium whitespace-pre-wrap"
              >
                {script}
              </p>
            </div>
          )}

          {/* Controls */}
          {audioUrl ? (
            <div className="space-y-3 pt-2">
              <audio src={audioUrl} controls className="w-full h-10 custom-audio rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setAudioBlob(null);
                    if (audioUrl) URL.revokeObjectURL(audioUrl);
                    setAudioUrl(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <RefreshCw size={14} /> Recommencer
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="py-2.5 px-3 rounded-xl bg-[var(--accent)] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-[var(--accent)]/30 disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>Envoyer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex justify-center">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isStarting || !selectedCountry}
                  className="w-full max-w-xs py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(220,38,38,0.5)] active:scale-95 motion-tap disabled:opacity-50 disabled:shadow-none"
                >
                  <Mic size={20} />
                  <span>{isStarting ? 'Démarrage...' : 'Enregistrer la Voix Off'}</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-full max-w-xs py-3.5 rounded-2xl bg-gray-800 text-white font-black text-sm flex items-center justify-center gap-2 border border-gray-700 active:scale-95 motion-tap"
                >
                  <Square size={18} className="fill-white" />
                  <span>Arrêter l'enregistrement</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* DESKTOP VIEW (hidden md:block) — UNCHANGED                       */}
      {/* ================================================================ */}
      <div className="hidden md:block">
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

        {/* 1. SÉLECTION DU PAYS */}
        <div className="mb-8">
          <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3">1. Sélectionnez le pays</h3>
          <div className="flex overflow-x-auto pb-4 gap-3 snap-x">
            {selectableCountries.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCountry(c)}
                className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border motion-tap ${
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

        {/* 2. MAIN CONTAINER */}
        <div className="block animate-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {!selectedCountry && (
              <div className="flex absolute inset-0 z-10 bg-[var(--app-bg)]/60 backdrop-blur-sm items-center justify-center rounded-3xl">
                <p className="text-lg font-medium text-[color:var(--ink)] bg-[var(--paper)] px-6 py-3 rounded-full shadow-lg border border-[var(--border)]">
                  Veuillez sélectionner un pays pour activer le studio
                </p>
              </div>
            )}

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
            <div id="tour-voixoff-studio" className="bg-[var(--ink)] rounded-3xl p-6 shadow-2xl border border-gray-800 flex flex-col relative overflow-hidden">
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
                      className="bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] px-6 py-2 rounded-full font-bold flex items-center gap-2 motion-tap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Traitement...' : <><Upload size={18} /> Traiter et Envoyer</>}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={isStarting}
                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                      >
                        <Mic size={20} /> {isStarting ? 'Démarrage...' : 'Commencer l\'enregistrement'}
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
        </div>
      </div>
    </div>
  );
}
