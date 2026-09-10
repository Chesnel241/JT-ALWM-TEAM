import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Square, Upload, Play, Pause, AlertCircle, RefreshCw, Send,
  CheckCircle, ZoomIn, ZoomOut, FileAudio, Radio, Volume2, FastForward,
  ChevronDown, RotateCcw
} from 'lucide-react';
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

export default function VoixOffView({
  countries = [],
  selectedWeek = '',
  weeks = [],
  setSelectedWeek,
  initialCountryId = null,
  isReporter = false,
  isActive = true,
}) {
  const { addToast } = useToast();
  const { lang, t } = useI18n();

  const selectableCountries = countries.filter((c) => c.id !== '_subscriptions');

  // Country selection state
  const [selectedCountry, setSelectedCountry] = useState(() => {
    if (initialCountryId) {
      return selectableCountries.find((c) => c.id === initialCountryId) || null;
    }
    return null;
  });

  useEffect(() => {
    if (initialCountryId && (!selectedCountry || selectedCountry.id !== initialCountryId)) {
      const match = selectableCountries.find((c) => c.id === initialCountryId);
      if (match) setSelectedCountry(match);
    }
  }, [initialCountryId, selectableCountries]);

  // Mode: Enregistrement micro direct OU import d'un fichier audio déjà existant
  const [inputMode, setInputMode] = useState('record'); // 'record' | 'upload'

  // Reportage context (1, 2, 3)
  const [reportageNum, setReportageNum] = useState(1);
  const [reportageTitle, setReportageTitle] = useState('');
  const [script, setScript] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStepText, setUploadStepText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0..100
  const [isAudioClipping, setIsAudioClipping] = useState(false);

  // Teleprompter state
  const [fontSize, setFontSize] = useState(20);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // 1, 1.5, 2
  const prompterRef = useRef(null);
  const mobilePrompterRef = useRef(null);

  // Refs for Web Audio API & MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const requestRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Timer counter
  useEffect(() => {
    let interval = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Auto-scroll loop for teleprompter
  useEffect(() => {
    if (!isAutoScrolling) return;
    let animId;
    const step = () => {
      const container = prompterRef.current || mobilePrompterRef.current;
      if (container) {
        container.scrollTop += 0.6 * scrollSpeed;
      }
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoScrolling, scrollSpeed]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stopVisualizer = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setAudioLevel(0);
    setIsAudioClipping(false);
  }, []);

  useEffect(() => {
    return () => {
      stopVisualizer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [audioUrl, stopVisualizer]);

  // Visualizer loop
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

      // Calcul volume moyen / crête
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
        if (dataArray[i] > peak) peak = dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(Math.round((avg / 255) * 100));
      setIsAudioClipping(peak > 240);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Dégradé : vert -> jaune -> rouge pour la saturation
        let r = 34, g = 197, b = 94; // vert
        if (dataArray[i] > 160) {
          r = 234; g = 179; b = 8; // jaune
        }
        if (dataArray[i] > 225) {
          r = 239; g = 68; b = 68; // rouge (clipping)
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  };

  const startRecording = async () => {
    if (isStarting || isRecording) return;
    if (!selectedCountry) {
      return addToast('Veuillez sélectionner un pays d\'abord.', 'error');
    }

    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

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
      setIsPaused(false);
      setRecordingSeconds(0);
      setAudioBlob(null);
      setAudioUrl(null);

      // Défilement automatique du prompteur activé si du texte est présent
      if (script.trim()) {
        setIsAutoScrolling(true);
      }

      setTimeout(drawVisualizer, 100);
    } catch (err) {
      console.error('Audio capture error:', err);
      addToast('Impossible d\'accéder au microphone. Vérifiez vos permissions.', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      setIsAutoScrolling(false);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      if (script.trim()) setIsAutoScrolling(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setIsAutoScrolling(false);
      stopVisualizer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(file.name)) {
      return addToast('Veuillez sélectionner un fichier audio valide (.mp3, .m4a, .wav).', 'error');
    }
    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    if (!reportageTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setReportageTitle(baseName);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob || !selectedCountry || !selectedWeek) return;

    const effectiveTitle = reportageTitle.trim() || `Reportage ${reportageNum}`;

    setIsUploading(true);
    setUploadStepText('Envoi du fichier vers le serveur...');

    const blobType = audioBlob.type || '';
    let ext = 'webm';
    if (blobType.includes('mp4')) ext = 'mp4';
    else if (blobType.includes('ogg')) ext = 'ogg';
    else if (blobType.includes('aac')) ext = 'aac';
    else if (blobType.includes('mpeg') || blobType.includes('mp3')) ext = 'mp3';
    else if (blobType.includes('wav')) ext = 'wav';

    const formData = new FormData();
    formData.append('audio', audioBlob, `voix-${Date.now()}.${ext}`);
    formData.append('reportageTitle', effectiveTitle);
    formData.append('script', script);

    try {
      setUploadStepText('Traitement studio broadcast FFmpeg (égalisation + compresseur dynamique)...');

      const res = await fetch(`/api/uploads/voiceover/${selectedWeek}/${selectedCountry.id}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-App-Password': localStorage.getItem('app-password') || '',
          'x-admin-password': localStorage.getItem('app-password') || '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors de l\'envoi de la voix-off.');
      }

      addToast('Voix off traitée et ajoutée aux rushes avec succès !', 'success', 6000);

      // Reset
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setReportageTitle('');
      setScript('');
      setIsAutoScrolling(false);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setIsUploading(false);
      setUploadStepText('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      {/* En-tête principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Mic size={26} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--ink)]">
                Studio Voix Off
              </h2>
              <span className="badge bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold">
                Broadcast TV
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[color:var(--muted)] mt-0.5">
              Enregistrez ou déposez votre voix. Traitement audio broadcast automatique.
            </p>
          </div>
        </div>

        {/* Sélecteur de semaine */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider">
            Semaine :
          </span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek?.(e.target.value)}
            className="bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-xs sm:text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            {weeks?.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Sélection ou Badge du Pays */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
            1. Pays d'attribution
          </span>
          {selectedCountry && isReporter && (
            <button
              onClick={() => setSelectedCountry(null)}
              className="text-xs text-[color:var(--accent)] hover:underline font-semibold"
            >
              Changer de pays
            </button>
          )}
        </div>

        {selectedCountry && isReporter ? (
          // Affichage épuré pour le journaliste : son pays est mis en valeur sans liste interminable
          <div className="p-4 bg-[var(--paper)] border-2 border-[color:var(--accent)]/40 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CountryAvatar country={selectedCountry} className="w-10 h-10 shadow-sm" />
              <div>
                <p className="font-bold text-sm text-[color:var(--ink)]">
                  {selectedCountry.name}
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  Les rushes voix-off seront rattachés au dossier {selectedCountry.name}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-3 py-1 rounded-full">
              <CheckCircle size={14} /> Attribué
            </span>
          </div>
        ) : (
          // Sélecteur complet de pays (Desktop ou si non-verrouillé)
          <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar custom-scrollbar">
            {selectableCountries.map((c) => {
              const isSelected = selectedCountry?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCountry(c)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-bold text-xs motion-tap active:scale-95 transition-all ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30 scale-105'
                      : 'bg-[var(--paper)] text-[color:var(--ink)] border border-[var(--border)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  <CountryAvatar country={c} className="w-5 h-5 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Préparation du Sujet & Mode d'entrée */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Formulaire & Prompteur (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-6 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
                2. Reportage & Script
              </span>

              {/* Toggle Record vs File */}
              <div className="flex bg-[var(--paper-2)] p-1 rounded-xl border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setInputMode('record')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'record'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                  }`}
                >
                  <Mic size={13} /> Direct Micro
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'upload'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                  }`}
                >
                  <FileAudio size={13} /> Fichier audio
                </button>
              </div>
            </div>

            {/* Sujet Buttons */}
            <div>
              <label className="block text-xs font-bold text-[color:var(--ink)] mb-1.5">
                Rattacher au sujet :
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setReportageNum(num);
                      if (!reportageTitle || reportageTitle.startsWith('Reportage ')) {
                        setReportageTitle(`Reportage ${num}`);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      reportageNum === num
                        ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-extrabold'
                        : 'border-[var(--border)] text-[color:var(--muted)] hover:bg-[var(--paper-2)]'
                    }`}
                  >
                    Sujet {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Titre du reportage */}
            <div>
              <label className="block text-xs font-bold text-[color:var(--ink)] mb-1">
                Titre du sujet / reportage
              </label>
              <input
                type="text"
                value={reportageTitle}
                onChange={(e) => setReportageTitle(e.target.value)}
                placeholder="Ex: Élections présidentielles — Ambiance bureaux de vote"
                className="w-full px-4 py-2.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-sm text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
            </div>

            {/* Script & Prompteur */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[color:var(--ink)]">
                  Texte pour le prompteur (optionnel)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                    className="p-1 rounded-lg border border-[var(--border)] text-[color:var(--muted)] hover:bg-[var(--paper-2)]"
                    title="Diminuer la taille du texte"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(36, s + 2))}
                    className="p-1 rounded-lg border border-[var(--border)] text-[color:var(--muted)] hover:bg-[var(--paper-2)]"
                    title="Agrandir la taille du texte"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Collez ou rédigez votre script ici. Il s'affichera dans le prompteur avec défilement automatique pendant votre lecture..."
                style={{ fontSize: `${fontSize}px` }}
                className="w-full p-4 bg-[var(--paper-2)] border border-[var(--border)] rounded-2xl text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed custom-scrollbar"
              />
            </div>
          </div>
        </div>

        {/* Colonne Droite : Enregistrement Studio Dark Pro (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            id="tour-voixoff-studio"
            className="bg-[#0b1120] text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 flex flex-col justify-between min-h-[460px] relative overflow-hidden"
          >
            {/* Top Bar : Statut & Vitesse prompteur */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <Radio size={14} className={isRecording ? 'text-red-400 animate-pulse' : 'text-slate-500'} />
                3. ENREGISTREUR TV
              </span>

              {isRecording ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  {isPaused ? 'EN PAUSE' : 'REC EN COURS'}
                </span>
              ) : (
                <span className="text-slate-500">PRÊT</span>
              )}
            </div>

            {/* Zone Prompteur interactif */}
            <div className="my-3 flex-1 flex flex-col min-h-[160px]">
              <div className="flex items-center justify-between pb-1.5 text-[11px] font-mono text-slate-400 border-b border-slate-800/80">
                <span>TÉLÉPROMPTEUR</span>
                {script.trim() && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1"
                    >
                      {isAutoScrolling ? <Pause size={10} /> : <Play size={10} />}
                      <span>Auto-scroll</span>
                    </button>
                    <select
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-0.5 outline-none"
                    >
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2.0x</option>
                    </select>
                  </div>
                )}
              </div>

              <div
                ref={prompterRef}
                className="flex-1 bg-black/40 rounded-xl p-4 overflow-y-auto mt-2 border border-slate-800/60 max-h-[180px] custom-scrollbar text-slate-100 font-medium leading-relaxed select-none"
                style={{ fontSize: `${Math.max(16, fontSize)}px` }}
              >
                {script.trim() ? (
                  <p className="whitespace-pre-wrap">{script}</p>
                ) : (
                  <p className="text-slate-500 text-xs italic text-center py-8">
                    Votre script apparaîtra ici avec défilement automatique pendant l'enregistrement.
                  </p>
                )}
              </div>
            </div>

            {/* Timer & Volume Meter */}
            <div className="space-y-3 py-2 text-center">
              <div className="font-mono text-4xl sm:text-5xl font-black tracking-wider text-white">
                {isRecording ? formatTimer(recordingSeconds) : '00:00'}
              </div>

              {/* Canvas visualizer & vumètre */}
              <div className="h-10 rounded-xl overflow-hidden bg-black/60 border border-slate-800 relative">
                <canvas ref={canvasRef} width="600" height="40" className="w-full h-full" />
                {isAudioClipping && (
                  <div className="absolute top-1 right-2 text-[10px] font-bold text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 animate-pulse">
                    ⚠️ Saturation audio
                  </div>
                )}
              </div>
            </div>

            {/* Mode Import de fichier */}
            {inputMode === 'upload' && !audioUrl && (
              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500 bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition-all motion-tap"
                >
                  <FileAudio size={28} className="text-purple-400" />
                  <span className="text-xs font-bold">Glissez ou sélectionnez un fichier audio</span>
                  <span className="text-[10px] text-slate-500">Formats acceptés : .mp3, .m4a, .wav, .aac</span>
                </button>
              </div>
            )}

            {/* Contrôles de Réécoute / Envoi */}
            {audioUrl ? (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-black/50 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Volume2 size={13} /> Pré-écoute
                    </span>
                    <span className="text-emerald-400 font-bold">Audio prêt</span>
                  </div>
                  <audio src={audioUrl} controls className="w-full h-9 custom-audio rounded-lg" />
                </div>

                {isUploading && (
                  <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-center space-y-1.5">
                    <div className="inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-purple-200 font-medium">
                      {uploadStepText}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
                      setAudioBlob(null);
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setIsAutoScrolling(false);
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> Recommencer
                  </button>

                  <button
                    type="button"
                    disabled={isUploading || !selectedCountry}
                    onClick={handleUpload}
                    className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>Envoyer au montage</span>
                  </button>
                </div>
              </div>
            ) : inputMode === 'record' ? (
              // Boutons d'enregistrement (Micro)
              <div className="pt-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isStarting || !selectedCountry}
                    className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(220,38,38,0.5)] active:scale-95 motion-tap disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    <Mic size={20} />
                    <span>{isStarting ? 'Démarrage...' : 'Commencer l\'enregistrement'}</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {isPaused ? (
                      <button
                        type="button"
                        onClick={resumeRecording}
                        className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 motion-tap transition-all shadow-lg shadow-emerald-600/30"
                      >
                        <Play size={16} /> Reprendre
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseRecording}
                        className="py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 motion-tap transition-all shadow-lg shadow-amber-600/30"
                      >
                        <Pause size={16} /> Pause
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center gap-1.5 border border-slate-700 active:scale-95 motion-tap transition-all"
                    >
                      <Square size={15} className="fill-white" /> Terminer
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
