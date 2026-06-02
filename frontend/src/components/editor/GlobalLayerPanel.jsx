import { useState } from 'react';
import { X, Newspaper, Radio, Image as ImageIcon, Music, Mic, Plus, Trash2, Upload, Sparkles, Layers } from 'lucide-react';
import { GLOBAL_TEMPLATES } from '../../data/overlayTemplates.js';
import { OverlayEditor } from './OverlayPanel.jsx';
import { api } from '../../api/index.js';

// Bouton d'upload d'un asset (musique/voix-off/image) → uploadAsset → {filename,name}.
function UploadBtn({ accept, label, uploadAsset, onUploaded }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-[var(--border)] text-xs cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] ${busy ? 'opacity-60 pointer-events-none' : 'text-[color:var(--muted)]'}`}>
      <Upload size={14} /> {busy ? 'Envoi…' : label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy || !uploadAsset}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { const r = await uploadAsset(f); if (r) onUploaded(r); }
          catch (err) { alert(`Échec de l'upload : ${err.message}`); }
          finally { setBusy(false); e.target.value = ''; }
        }}
      />
    </label>
  );
}

const POSITIONS = [
  { id: 'tl', label: 'Haut gauche' }, { id: 'tr', label: 'Haut droite' },
  { id: 'bl', label: 'Bas gauche' }, { id: 'br', label: 'Bas droite' },
  { id: 'center', label: 'Centre' },
];

/**
 * Habillage global du JT : ticker, LIVE, logo, fond sonore (musique), voix-off,
 * incrustations images. Les fichiers audio/image proviennent des uploads de la
 * semaine (props audioFiles / imageFiles : [{filename, name}]).
 */
export default function GlobalLayerPanel({ value, onChange, onClose, audioFiles = [], imageFiles = [], uploadAsset, inline = false }) {
  const v = value;
  const setTicker = (p) => onChange({ ...v, ticker: { ...v.ticker, ...p } });
  const setLive = (p) => onChange({ ...v, live: { ...v.live, ...p } });
  const setMusic = (p) => onChange({ ...v, music: { ...v.music, ...p } });
  const setAtmo = (p) => onChange({ ...v, atmosphere: { ...(v.atmosphere || {}), ...p } });
  const setVoice = (p) => onChange({ ...v, voiceover: { ...v.voiceover, ...p } });
  const setImages = (arr) => onChange({ ...v, imageOverlays: arr });
  const setOverlays = (arr) => onChange({ ...v, overlays: arr });

  const addOverlay = (templateId) => {
    setOverlays([
      ...(v.overlays || []),
      {
        id: `${templateId}-${Date.now()}`,
        templateId,
        fields: {},
        animation: 'fade',
        startTime: 0,
        duration: null,
      },
    ]);
  };
  const updOverlay = (idx, upd) => {
    const copy = [...(v.overlays || [])];
    copy[idx] = upd;
    setOverlays(copy);
  };
  const rmOverlay = (idx) => {
    setOverlays((v.overlays || []).filter((_, i) => i !== idx));
  };

  const [themes, setThemes] = useState([]);
  const [themeName, setThemeName] = useState('');
  const [loadingThemes, setLoadingThemes] = useState(false);

  const loadThemes = async () => {
    setLoadingThemes(true);
    try {
      const data = await api.getThemes();
      setThemes(data || []);
    } catch (err) {
      console.error('Failed to load themes', err);
    } finally {
      setLoadingThemes(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!themeName.trim()) return alert('Entrez un nom pour le thème');
    try {
      const payload = {
        name: themeName,
        branding: v,
      };
      await api.saveTheme(payload);
      setThemeName('');
      loadThemes();
      alert('Thème sauvegardé avec succès !');
    } catch (err) {
      alert('Erreur lors de la sauvegarde du thème');
    }
  };

  const handleDeleteTheme = async (id) => {
    if (!confirm('Supprimer ce thème ?')) return;
    try {
      await api.deleteTheme(id);
      loadThemes();
    } catch (err) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleApplyTheme = (theme) => {
    if (confirm(`Appliquer le thème "${theme.name}" ? Cela écrasera votre configuration globale actuelle.`)) {
      onChange(theme.branding);
    }
  };

  const field = 'w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]';
  const sectionCls = 'flex flex-col gap-3 border border-[var(--border)] rounded-xl p-4';
  const head = (icon, label, checked, onToggle) => (
    <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
      <span className="flex items-center gap-2">{icon} {label}</span>
      {onToggle && <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />}
    </label>
  );

  const addImage = () => setImages([...(v.imageOverlays || []), { filename: imageFiles[0]?.filename || '', position: 'tr', scale: 0.25, opacity: 1, startTime: 0 }]);
  const updImage = (i, p) => setImages(v.imageOverlays.map((im, idx) => (idx === i ? { ...im, ...p } : im)));
  const rmImage = (i) => setImages(v.imageOverlays.filter((_, idx) => idx !== i));

  const content = (
    <div className={`bg-[var(--paper)] w-full flex flex-col overflow-hidden ${inline ? 'h-full border-l border-[var(--border)]' : 'rounded-2xl max-w-lg shadow-2xl border border-[var(--border)] max-h-[90vh]'}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Newspaper className="text-[var(--accent)]" size={18} /> Habillage JT (global)
          </h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Section Modèles / Préférences */}
          <section className={sectionCls}>
            {head(<Layers size={15} />, 'Modèles & Préférences', null)}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input 
                  className={field} 
                  placeholder="Nom du nouveau modèle..." 
                  value={themeName} 
                  onChange={(e) => setThemeName(e.target.value)} 
                />
                <button 
                  onClick={handleSaveTheme}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm whitespace-nowrap hover:opacity-90"
                >
                  Sauvegarder
                </button>
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <button onClick={loadThemes} className="text-xs text-[var(--accent)] font-medium text-left underline w-fit">
                  Rafraîchir les modèles sauvegardés
                </button>
                {themes.length === 0 && !loadingThemes && (
                  <p className="text-xs text-[var(--muted)]">Aucun modèle sauvegardé.</p>
                )}
                {themes.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 border border-[var(--border)] rounded-lg bg-[var(--paper-2)]">
                    <span className="text-sm font-medium text-[var(--ink)]">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApplyTheme(t)} className="px-3 py-1 bg-[var(--ink)] text-[var(--paper)] text-xs rounded-md">Appliquer</button>
                      <button onClick={() => handleDeleteTheme(t.id)} className="p-1 text-[var(--muted)] hover:text-red-500 rounded"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Ticker */}
          <section className={sectionCls}>
            {head(<Newspaper size={15} />, 'Bande défilante (ticker)', v.ticker.enabled, (c) => setTicker({ enabled: c }))}
            {v.ticker.enabled && (
              <>
                <input className={field} placeholder="Catégorie (ex: ALERTE)" value={v.ticker.categorie} onChange={(e) => setTicker({ categorie: e.target.value })} />
                <input className={field} placeholder="Texte défilant (séparez par •)" value={v.ticker.texte} onChange={(e) => setTicker({ texte: e.target.value })} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--muted)] flex items-center justify-between">
                    <span>Vitesse de défilement</span>
                    <span className="text-[color:var(--ink)]">
                      {['Pro (60 px/s)', 'Lent', 'Standard', 'Rapide', 'Très rapide'][(v.ticker.speed || 1) - 1]}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={v.ticker.speed || 1}
                    onChange={(e) => setTicker({ speed: parseInt(e.target.value, 10) || 1 })}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                
                {/* Sliders Position / Scale Ticker */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position X</label>
                    <input type="range" min="-1920" max="1920" step="10" value={v.ticker.posX ?? 0} onChange={(e) => setTicker({ posX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position Y</label>
                    <input type="range" min="-1080" max="1080" step="10" value={v.ticker.posY ?? 0} onChange={(e) => setTicker({ posY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Taille (%)</label>
                    <input type="range" min="10" max="300" step="5" value={v.ticker.scale ?? 100} onChange={(e) => setTicker({ scale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Taille Texte (%)</label>
                    <input type="range" min="50" max="250" step="5" value={v.ticker.fontSize ?? 100} onChange={(e) => setTicker({ fontSize: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Interligne (%)</label>
                    <input type="range" min="50" max="250" step="5" value={v.ticker.lineHeight ?? 120} onChange={(e) => setTicker({ lineHeight: parseInt(e.target.value, 10) || 120 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* LIVE */}
          <section className={sectionCls}>
            {head(<Radio size={15} />, 'Badge LIVE / DIRECT', v.live.enabled, (c) => setLive({ enabled: c }))}
            {v.live.enabled && (
              <>
                <div className="flex gap-2">
                  {['LIVE', 'DIRECT'].map((l) => (
                    <button key={l} onClick={() => setLive({ label: l })} className={`px-3 py-1.5 rounded-lg text-sm border ${v.live.label === l ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[color:var(--muted)]'}`}>{l}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position X</label>
                    <input type="range" min="-1920" max="1920" step="10" value={v.live.posX ?? 0} onChange={(e) => setLive({ posX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position Y</label>
                    <input type="range" min="-1080" max="1080" step="10" value={v.live.posY ?? 0} onChange={(e) => setLive({ posY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Taille (%)</label>
                    <input type="range" min="10" max="300" step="5" value={v.live.scale ?? 100} onChange={(e) => setLive({ scale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Taille Texte (%)</label>
                    <input type="range" min="50" max="250" step="5" value={v.live.fontSize ?? 100} onChange={(e) => setLive({ fontSize: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Interligne (%)</label>
                    <input type="range" min="50" max="250" step="5" value={v.live.lineHeight ?? 120} onChange={(e) => setLive({ lineHeight: parseInt(e.target.value, 10) || 120 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Logo */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
              <span className="flex items-center gap-2"><ImageIcon size={15} /> Logo chaîne</span>
              <input type="checkbox" checked={v.logo} onChange={(e) => onChange({ ...v, logo: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            </label>
            {v.logo && (
              <>
                <select className={field} value={v.logoPosition || 'br'} onChange={(e) => onChange({ ...v, logoPosition: e.target.value })}>
                  {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position X</label>
                    <input type="range" min="-1920" max="1920" step="10" value={v.logoPosX ?? 0} onChange={(e) => onChange({ ...v, logoPosX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Position Y</label>
                    <input type="range" min="-1080" max="1080" step="10" value={v.logoPosY ?? 0} onChange={(e) => onChange({ ...v, logoPosY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase">Taille (%)</label>
                    <input type="range" min="10" max="300" step="5" value={v.logoScale ?? 100} onChange={(e) => onChange({ ...v, logoScale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Atmosphère cinéma : vignette + grain + sweep lumineux */}
          <section className={sectionCls}>
            <label className="flex items-center gap-2 font-semibold text-sm text-[color:var(--ink)]">
              <Sparkles size={15} /> Atmosphère cinéma
            </label>
            {[
              ['vignette', 'Vignettage'],
              ['grain', 'Grain (film)'],
              ['sweep', 'Sweep lumineux'],
            ].map(([k, lab]) => {
              const val = (v.atmosphere && v.atmosphere[k]) || 0;
              return (
                <div key={k} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[color:var(--muted)] flex items-center justify-between">
                    <span>{lab}</span>
                    <span className="text-[color:var(--ink)]">{Math.round(val * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={val}
                    onChange={(e) => setAtmo({ [k]: parseFloat(e.target.value) })}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              );
            })}
          </section>

          {/* Musique */}
          <section className={sectionCls}>
            {head(<Music size={15} />, 'Fond sonore (musique)', v.music.enabled, (c) => setMusic({ enabled: c }))}
            {v.music.enabled && (
              <>
                <div className="flex gap-2">
                  <select className={field} value={v.music.filename} onChange={(e) => setMusic({ filename: e.target.value })}>
                    <option value="">— Choisir un fichier audio —</option>
                    {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <UploadBtn accept="audio/*" label="Uploader" uploadAsset={uploadAsset} onUploaded={(r) => setMusic({ filename: r.filename })} />
                </div>
                <label className="text-xs text-[color:var(--muted)]">Volume : {Math.round((v.music.volume ?? 0.2) * 100)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={v.music.volume ?? 0.2} onChange={(e) => setMusic({ volume: parseFloat(e.target.value) })} className="w-full accent-[var(--accent)]" />
                <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                  <input type="checkbox" checked={v.music.duck} onChange={(e) => setMusic({ duck: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
                  Baisser sous la voix (ducking)
                </label>
              </>
            )}
          </section>

          {/* Voix-off */}
          <section className={sectionCls}>
            {head(<Mic size={15} />, 'Voix-off', v.voiceover.enabled, (c) => setVoice({ enabled: c }))}
            {v.voiceover.enabled && (
              <>
                <div className="flex gap-2">
                  <select className={field} value={v.voiceover.filename} onChange={(e) => setVoice({ filename: e.target.value })}>
                    <option value="">— Choisir un fichier audio —</option>
                    {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <UploadBtn accept="audio/*" label="Uploader" uploadAsset={uploadAsset} onUploaded={(r) => setVoice({ filename: r.filename })} />
                </div>
                <label className="text-xs text-[color:var(--muted)]">Départ (s)</label>
                <input className={field} type="number" min="0" step="0.5" value={v.voiceover.startTime ?? 0} onChange={(e) => setVoice({ startTime: parseFloat(e.target.value) || 0 })} />
              </>
            )}
          </section>

          {/* Images */}
          <section className={sectionCls}>
            {head(<ImageIcon size={15} />, 'Incrustations images', null)}
            {(v.imageOverlays || []).map((im, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <select className={field} value={im.filename} onChange={(e) => updImage(i, { filename: e.target.value })}>
                    <option value="">— Image —</option>
                    {imageFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <button onClick={() => rmImage(i)} className="p-2 text-[color:var(--muted)] hover:text-[var(--signal)]"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className={field} value={im.position} onChange={(e) => updImage(i, { position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <input className={field} type="number" min="0.05" max="1" step="0.05" value={im.scale} onChange={(e) => updImage(i, { scale: parseFloat(e.target.value) })} title="Taille (0–1)" />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              {imageFiles.length > 0 && (
                <button onClick={addImage} className="flex-1 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <Plus size={15} /> Image existante
                </button>
              )}
              <UploadBtn
                accept="image/*"
                label="Uploader une image"
                uploadAsset={uploadAsset}
                onUploaded={(r) => setImages([...(v.imageOverlays || []), { filename: r.filename, position: 'tr', scale: 0.25, opacity: 1, startTime: 0 }])}
              />
            </div>
          </section>

          {/* Animations & Habillages Globaux (Alerte, Flash...) */}
          <section className={sectionCls}>
            {head(<Layers size={15} />, 'Animations & Habillages Globaux', null)}
            
            <div className="flex gap-2">
              <select className={field} onChange={(e) => { if(e.target.value) { addOverlay(e.target.value); e.target.value = ''; } }}>
                <option value="">— Ajouter un habillage global —</option>
                {GLOBAL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
            </div>

            {(v.overlays || []).map((overlay, idx) => (
              <OverlayEditor
                key={overlay.id}
                overlay={overlay}
                onChange={(upd) => updOverlay(idx, upd)}
                onRemove={() => rmOverlay(idx)}
              />
            ))}
          </section>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-semibold text-sm hover:opacity-90">Terminé</button>
        </div>
      </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      {content}
    </div>
  );
}
