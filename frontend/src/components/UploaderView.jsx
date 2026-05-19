import { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, Folder, FileText, Video,
  CheckCircle, Clock, ChevronRight, Trash2, AlertCircle,
} from 'lucide-react';
import { api } from '../api/index.js';

const FILE_ICONS = {
  video: { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-100' },
  script: { Icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100' },
};

export default function UploaderView({ country, weeks, selectedWeek, setSelectedWeek, onBack }) {
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState([]); // { id, name, progress, status, error }
  const [scriptText, setScriptText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const intervalsRef = useRef({});

  // Charger les fichiers existants
  useEffect(() => {
    if (!selectedWeek) return;
    api.getUploads(selectedWeek, country.id).then(setUploads).catch(console.error);
  }, [selectedWeek, country.id]);

  // Cleanup des intervals au démontage
  useEffect(() => {
    return () => Object.values(intervalsRef.current).forEach(clearInterval);
  }, []);

  const simulateProgress = (tempId, file) => {
    let progress = 0;
    intervalsRef.current[tempId] = setInterval(() => {
      progress = Math.min(progress + Math.random() * 20 + 5, 95);
      setUploading((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, progress } : f))
      );
    }, 400);
  };

  const finishUpload = (tempId, result, error = null) => {
    clearInterval(intervalsRef.current[tempId]);
    delete intervalsRef.current[tempId];

    if (error) {
      setUploading((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, progress: 0, status: 'error', error } : f))
      );
      return;
    }

    setUploading((prev) =>
      prev.map((f) => (f.id === tempId ? { ...f, progress: 100, status: 'completed' } : f))
    );
    setUploads((prev) => [...prev, result]);
  };

  const handleFiles = (filesList) => {
    Array.from(filesList).forEach((file) => {
      const tempId = Math.random().toString(36).slice(2);
      setUploading((prev) => [...prev, { id: tempId, name: file.name, progress: 0, status: 'uploading' }]);
      simulateProgress(tempId, file);

      api
        .uploadFile(selectedWeek, country.id, file)
        .then((result) => finishUpload(tempId, result))
        .catch((err) => finishUpload(tempId, null, err.message));
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFiles(e.dataTransfer.files);
  };

  const handleScriptSubmit = async () => {
    if (!scriptText.trim()) return;
    try {
      const result = await api.submitScript(selectedWeek, country.id, scriptText);
      setUploads((prev) => [...prev, result]);
      setScriptText('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await api.deleteFile(selectedWeek, country.id, fileId);
      setUploads((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <button onClick={onBack} type="button" className="btn btn-ghost border border-[var(--border)]">
          Pays
        </button>
        <ChevronRight size={16} className="text-[color:var(--muted)]" />
        <span className="font-semibold text-2xl text-[color:var(--ink)] flex items-center gap-2">
          {country.name}
          <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
            {country.code}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8">
        {/* Colonne principale */}
        <div className="space-y-6">
          {/* Sélecteur semaine */}
          <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[color:var(--ink)]">Semaine de diffusion</h3>
              <p className="text-sm text-[color:var(--muted)]">Verifiez le bon dossier avant de deposer.</p>
            </div>
            <label className="sr-only" htmlFor="uploader-week">
              Choisir la semaine de diffusion
            </label>
            <select
              id="uploader-week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2 font-medium"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.dates}){w.status === 'active' ? ' - EN COURS' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Zone drag & drop */}
          <div
            className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
              dragActive
                ? 'border-[color:var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--paper)] hover:border-[color:var(--accent)]'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadCloud className={`mx-auto h-14 w-14 mb-4 transition-transform duration-200 ${
              dragActive ? 'text-[color:var(--accent-deep)] scale-[1.05]' : 'text-[color:var(--muted)]'
            }`} />
            <h3 className="text-lg font-semibold text-[color:var(--ink)] mb-2">
              Glissez-déposez vos fichiers ici
            </h3>
            <p className="text-[color:var(--muted)] text-sm mb-6">
              Vidéos (MP4, MOV), Audios (MP3, WAV), Scripts (TXT, DOCX).
            </p>
            <label className="btn btn-primary cursor-pointer">
              Parcourir les fichiers
              <input
                type="file"
                className="hidden"
                multiple
                aria-label="Selectionner des fichiers a envoyer"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
          </div>

          {/* Saisie rapide de script */}
          <div className="panel p-6">
            <h3 className="font-semibold text-[color:var(--ink)] mb-3 flex items-center gap-2">
              <FileText size={18} className="text-[color:var(--signal)]" />
              Saisir un script rapidement
            </h3>
            <textarea
              className="w-full border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[color:var(--accent)] outline-none mb-3 bg-[var(--paper)]"
              rows="4"
              placeholder="Collez ici le texte de la voix off ou vos notes pour le monteur..."
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={handleScriptSubmit}
                disabled={!scriptText.trim()}
                type="button"
                className="btn btn-primary disabled:opacity-50"
              >
                Ajouter le script
              </button>
            </div>
          </div>

          {/* Transferts en cours */}
          {uploading.length > 0 && (
            <div className="panel p-6">
              <h3 className="font-semibold text-[color:var(--ink)] mb-4">Transferts en cours</h3>
              <div className="space-y-4">
                {uploading.map((f) => (
                  <div key={f.id} className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)]">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-[color:var(--ink)] truncate pr-4">{f.name}</span>
                      {f.status === 'completed' && (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle size={14} /> Terminé
                        </span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle size={14} /> {f.error}
                        </span>
                      )}
                      {f.status === 'uploading' && (
                        <span className="text-[color:var(--accent-deep)]">{Math.round(f.progress)}%</span>
                      )}
                    </div>
                    <div className="w-full bg-[var(--paper-2)] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          f.status === 'completed'
                            ? 'bg-emerald-500'
                            : f.status === 'error'
                            ? 'bg-red-400'
                            : 'bg-[color:var(--accent)]'
                        }`}
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne latérale : fichiers sur le serveur */}
        <div className="panel p-6 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <Folder className="text-[color:var(--muted)]" />
            <h3 className="font-semibold text-[color:var(--ink)]">
              Dossier: {weeks.find((w) => w.id === selectedWeek)?.name}
            </h3>
          </div>

          {uploads.length === 0 ? (
            <div className="text-center text-[color:var(--muted)] py-8 flex flex-col items-center">
              <Clock size={32} className="text-[color:var(--muted)] mb-2" />
              <p className="text-sm">Aucun fichier uploadé pour l'instant.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {uploads.map((file) => {
                const { Icon, color, bg } = FILE_ICONS[file.type] || FILE_ICONS.script;
                return (
                  <li
                    key={file.id}
                    className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)] flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-md ${bg}`}>
                      <Icon size={18} className={color} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-[color:var(--ink)] truncate">{file.name}</p>
                      <p className="text-xs text-[color:var(--muted)]">{file.size}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(file.id)}
                      type="button"
                      className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
