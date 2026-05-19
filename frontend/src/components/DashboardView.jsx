import { useState, useEffect } from 'react';
import { Folder, FileText, Video, Download, Trash2 } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';

export default function DashboardView({ weeks, selectedWeek, setSelectedWeek, countries }) {
  const { addToast } = useToast();
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDashboard(selectedWeek)
      .then(setDashboard)
      .catch((err) => {
        console.error(err);
        addToast('Erreur lors du chargement', 'error', 3000);
      })
      .finally(() => setLoading(false));
  }, [selectedWeek, addToast]);

  const openDeleteDialog = (countryId, fileId) => {
    const file = dashboard[countryId]?.find(f => f.id === fileId);
    if (file) {
      setFileToDelete({ countryId, fileId, fileName: file.name });
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteFile(selectedWeek, fileToDelete.countryId, fileToDelete.fileId);
      setDashboard((prev) => ({
        ...prev,
        [fileToDelete.countryId]: prev[fileToDelete.countryId].filter((f) => f.id !== fileToDelete.fileId),
      }));
      addToast(`${fileToDelete.fileName} supprimé`, 'success', 3000);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err) {
      addToast(`Erreur : ${err.message}`, 'error', 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const countriesWithUploads = Object.keys(dashboard).filter(
    (id) => dashboard[id]?.length > 0
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
        <div>
          <div className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] mb-3">Montage</div>
          <h2 className="text-3xl md:text-4xl font-semibold text-[color:var(--ink)] mb-2">Tableau de bord</h2>
          <p className="text-[color:var(--muted)]">Vue centralisee des elements recus et scripts.</p>
        </div>
        <div className="panel p-2 flex items-center gap-3">
          <label className="sr-only" htmlFor="dashboard-week">
            Choisir la semaine de diffusion
          </label>
          <span className="text-sm text-[color:var(--muted)] font-medium">Semaine</span>
          <select
            id="dashboard-week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2 font-semibold focus:ring-0 cursor-pointer"
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard count={3} />
        </div>
      ) : countriesWithUploads.length === 0 ? (
        <div className="panel border-2 border-dashed p-12 text-center">
          <Folder className="mx-auto h-16 w-16 text-[color:var(--muted)] mb-4" />
          <h3 className="text-xl font-medium text-[color:var(--ink)]">Aucun element recu pour cette semaine</h3>
          <p className="text-[color:var(--muted)] mt-2">
            Les fichiers apparaîtront ici dès que les correspondants les uploaderont.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {countriesWithUploads.map((countryId) => {
            const country = countries.find((c) => c.id === countryId);
            const files = dashboard[countryId];
            const videos = files.filter((f) => f.type === 'video');
            const scripts = files.filter((f) => f.type === 'script');

            return (
              <div
                key={countryId}
                className="panel overflow-hidden"
              >
                {/* En-tête pays */}
                <div className="bg-[var(--paper)] border-b border-[var(--border)] p-4 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center font-bold text-sm text-[color:var(--accent-deep)]">
                      {country?.code}
                    </div>
                    <span className="font-semibold text-[color:var(--ink)]">{country?.name}</span>
                  </div>
                  <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
                    {files.length} fichier{files.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Fichiers */}
                <div className="p-4 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
                  {videos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Video size={12} /> Videos / Rushs
                      </h4>
                      <ul className="space-y-2">
                        {videos.map((file) => (
                          <li
                            key={file.id}
                            className="flex justify-between items-center text-sm bg-[var(--paper)] p-2 rounded-2xl border border-[var(--border)]"
                          >
                            <span className="truncate pr-2 font-medium text-[color:var(--ink)]">{file.name}</span>
                            <div className="flex gap-1">
                              <a
                                href={`/uploads/${file.filename}`}
                                download={file.name}
                                className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1 rounded"
                                title="Télécharger"
                              >
                                <Download size={16} />
                              </a>
                              <button
                                onClick={() => openDeleteDialog(countryId, file.id)}
                                className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {scripts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText size={12} /> Scripts / Notes
                      </h4>
                      <ul className="space-y-2">
                        {scripts.map((file) => (
                          <li
                            key={file.id}
                            className="flex justify-between items-center text-sm bg-[var(--signal)]/10 p-2 rounded-2xl border border-[var(--signal)]/30"
                          >
                            <span className="truncate pr-2 font-medium text-[color:var(--ink)]">{file.name}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setViewingScript(file)}
                                type="button"
                                className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1 rounded px-2 text-xs font-medium"
                              >
                                Lire
                              </button>
                              <button
                                onClick={() => openDeleteDialog(countryId, file.id)}
                                type="button"
                                className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Télécharger tout */}
                <div className="p-4 bg-[var(--paper)] border-t border-[var(--border)] mt-auto flex justify-end">
                  <a
                    href={`/api/uploads/${selectedWeek}/${countryId}/archive`}
                    download={`uploads_${selectedWeek}_${country?.code || countryId}.zip`}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download size={16} />
                    Telecharger ZIP ({country?.code})
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal lecture script */}
      {viewingScript && (
        <div
          className="fixed inset-0 bg-[color:oklch(0.2_0.02_250_/_0.6)] flex items-center justify-center p-4 z-50"
          onClick={() => setViewingScript(null)}
          role="presentation"
        >
          <div
            className="panel w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-modal-title"
          >
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--paper)] rounded-t-2xl">
              <h3 id="script-modal-title" className="font-semibold text-[color:var(--ink)] flex items-center gap-2">
                <FileText className="text-[color:var(--signal)]" />
                {viewingScript.name}
              </h3>
              <button
                onClick={() => setViewingScript(null)}
                type="button"
                aria-label="Fermer la lecture du script"
                className="text-[color:var(--muted)] hover:text-[color:var(--ink)] p-2 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-sm whitespace-pre-wrap text-[color:var(--ink)]">
              {viewingScript.content || 'Contenu non disponible.'}
            </div>
            <div className="p-4 border-t border-[var(--border)] bg-[var(--paper)] flex justify-end">
              {viewingScript.filename && (
                <a
                  href={`/uploads/${viewingScript.filename}`}
                  download={viewingScript.name}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Download size={16} /> Telecharger .txt
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Supprimer ce fichier ?"
        message={`Êtes-vous sûr de vouloir supprimer "${fileToDelete?.fileName}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setFileToDelete(null);
        }}
      />
    </div>
  );
}
