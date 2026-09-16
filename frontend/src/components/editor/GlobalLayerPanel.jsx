import { useId, useState } from 'react';
import { X, Newspaper, Radio, Image as ImageIcon, Music, Mic, Plus, Trash2, Upload, Sparkles, Layers } from 'lucide-react';
import { GLOBAL_TEMPLATES, MOMENTS_IDS, animationRecommandee, habillagesDuMoment } from '../../data/overlayTemplates.js';
import { OverlayEditor } from './OverlayPanel.jsx';
import { api } from '../../api/index.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { usePiegeFocus } from '../../hooks/usePiegeFocus.jsx';

// Bouton d'upload d'un asset (musique/voix-off/image) → uploadAsset → {filename,name}.
function UploadBtn({ accept, label, envoiLabel, uploadAsset, onUploaded }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-[var(--border)] text-xs cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] ${busy ? 'opacity-60 pointer-events-none' : 'text-[color:var(--muted)]'}`}>
      <Upload size={14} /> {busy ? envoiLabel : label}
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
export default function GlobalLayerPanel({ value, onChange, onClose, audioFiles = [], imageFiles = [], uploadAsset, inline = false, adminPassword }) {
  // Un préfixe par instance : le panneau peut être monté deux fois dans la
  // page, et un identifiant partagé ferait donner le focus au curseur du
  // voisin quand on clique un libellé.
  const idc = useId();
  // Ce panneau annonçait `role="dialog" aria-modal="true"` sans en être un :
  // la tabulation repartait derrière le voile, sur les boutons de la page
  // qu'on croyait avoir quittée, et Échap ne fermait rien. En mode `inline` il
  // n'est pas modal — il vit dans la mise en page —, donc le piège s'y tait.
  const boiteModale = usePiegeFocus(!inline, onClose);
  const { t } = useI18n();
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
        animation: animationRecommandee(templateId),
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
      await api.saveTheme(payload, adminPassword);
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
      await api.deleteTheme(id, adminPassword);
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
            {head(<Layers size={15} />, t.studio.panneaux.modeles, null)}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input 
                  className={field} 
                  placeholder={t.studio.panneaux.modeleNom} 
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
                  {t.studio.panneaux.modelesRafraichir}
                </button>
                {themes.length === 0 && !loadingThemes && (
                  <p className="text-xs text-[var(--muted)]">{t.studio.panneaux.modelesAucun}</p>
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
            {head(<Newspaper size={15} />, t.studio.panneaux.ticker, v.ticker.enabled, (c) => setTicker({ enabled: c }))}
            {v.ticker.enabled && (
              <>
                <input className={field} placeholder={t.studio.panneaux.tickerCategorie} value={v.ticker.categorie} onChange={(e) => setTicker({ categorie: e.target.value })} />
                <input className={field} placeholder={t.studio.panneaux.tickerTexte} value={v.ticker.texte} onChange={(e) => setTicker({ texte: e.target.value })} />
                <div className="flex flex-col gap-1">
                  {/* La valeur sort du libellé : associé tel quel, le nom du
                      curseur deviendrait « Vitesse de défilement Rapide » et
                      changerait à chaque cran, alors que la valeur est déjà
                      annoncée par `aria-valuenow`. */}
                  <div className="text-xs font-medium text-[color:var(--muted)] flex items-center justify-between">
                    <label htmlFor={`${idc}-vitesse`}>{t.studio.panneaux.tickerVitesse}</label>
                    <span className="text-[color:var(--ink)]">
                      {t.studio.panneaux.vitesses[(v.ticker.speed || 1) - 1]}
                    </span>
                  </div>
                  <input
                    id={`${idc}-vitesse`}
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
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionX-1`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionX}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.ticker.posX ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionX-1`} type="range" min="-1920" max="1920" step="10" value={v.ticker.posX ?? 0} onChange={(e) => setTicker({ posX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionY-1`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionY}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.ticker.posY ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionY-1`} type="range" min="-1080" max="1080" step="10" value={v.ticker.posY ?? 0} onChange={(e) => setTicker({ posY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-taille-1`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.taille}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.ticker.scale ?? 100}%</span>
                    </div>
                    <input id={`${idc}-taille-1`} type="range" min="10" max="300" step="5" value={v.ticker.scale ?? 100} onChange={(e) => setTicker({ scale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {/* « Interligne » retiré ici et sur le badge LIVE : la
                      valeur était écrite et validée, mais lue par aucun moteur
                      de rendu. Elle revient avec l'échelle typographique. */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${idc}-texte-1`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.tickerTailleTexte}</label>
                    <input id={`${idc}-texte-1`} type="range" min="50" max="250" step="5" value={v.ticker.fontSize ?? 100} onChange={(e) => setTicker({ fontSize: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* LIVE */}
          <section className={sectionCls}>
            {head(<Radio size={15} />, t.studio.panneaux.badgeLive, v.live.enabled, (c) => setLive({ enabled: c }))}
            {v.live.enabled && (
              <>
                <div className="flex gap-2">
                  {['LIVE', 'DIRECT'].map((l) => (
                    <button key={l} onClick={() => setLive({ label: l })} className={`px-3 py-1.5 rounded-lg text-sm border ${v.live.label === l ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[color:var(--muted)]'}`}>{l}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionX-2`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionX}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.live.posX ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionX-2`} type="range" min="-1920" max="1920" step="10" value={v.live.posX ?? 0} onChange={(e) => setLive({ posX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionY-2`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionY}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.live.posY ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionY-2`} type="range" min="-1080" max="1080" step="10" value={v.live.posY ?? 0} onChange={(e) => setLive({ posY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-taille-2`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.taille}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.live.scale ?? 100}%</span>
                    </div>
                    <input id={`${idc}-taille-2`} type="range" min="10" max="300" step="5" value={v.live.scale ?? 100} onChange={(e) => setLive({ scale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${idc}-texte-2`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.tickerTailleTexte}</label>
                    <input id={`${idc}-texte-2`} type="range" min="50" max="250" step="5" value={v.live.fontSize ?? 100} onChange={(e) => setLive({ fontSize: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Logo */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
              <span className="flex items-center gap-2"><ImageIcon size={15} /> {t.studio.panneaux.logoChaine}</span>
              <input type="checkbox" checked={v.logo} onChange={(e) => onChange({ ...v, logo: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            </label>
            {v.logo && (
              <>
                <select className={field} value={v.logoPosition || 'br'} onChange={(e) => onChange({ ...v, logoPosition: e.target.value })}>
                  {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionX-3`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionX}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.logoPosX ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionX-3`} type="range" min="-1920" max="1920" step="10" value={v.logoPosX ?? 0} onChange={(e) => onChange({ ...v, logoPosX: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-positionY-3`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.positionY}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.logoPosY ?? 0}</span>
                    </div>
                    <input id={`${idc}-positionY-3`} type="range" min="-1080" max="1080" step="10" value={v.logoPosY ?? 0} onChange={(e) => onChange({ ...v, logoPosY: parseInt(e.target.value, 10) || 0 })} className="w-full accent-[var(--accent)]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`${idc}-taille-3`} className="text-[10px] font-medium text-[color:var(--muted)] uppercase">{t.studio.panneaux.taille}</label>
                      <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{v.logoScale ?? 100}%</span>
                    </div>
                    <input id={`${idc}-taille-3`} type="range" min="10" max="300" step="5" value={v.logoScale ?? 100} onChange={(e) => onChange({ ...v, logoScale: parseInt(e.target.value, 10) || 100 })} className="w-full accent-[var(--accent)]" />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Atmosphère cinéma : vignette + grain + sweep lumineux */}
          <section className={sectionCls}>
            <label className="flex items-center gap-2 font-semibold text-sm text-[color:var(--ink)]">
              <Sparkles size={15} /> {t.studio.panneaux.atmosphere}
            </label>
            {[
              ['vignette', t.studio.panneaux.vignettage],
              ['grain', t.studio.panneaux.grain],
              ['sweep', t.studio.panneaux.balayage],
            ].map(([k, lab]) => {
              const val = (v.atmosphere && v.atmosphere[k]) || 0;
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-[color:var(--muted)] flex items-center justify-between">
                    <label htmlFor={`${idc}-${k}`}>{lab}</label>
                    <span className="text-[color:var(--ink)]">{Math.round(val * 100)}%</span>
                  </div>
                  <input
                    id={`${idc}-${k}`}
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
            {head(<Music size={15} />, t.studio.panneaux.musique, v.music.enabled, (c) => setMusic({ enabled: c }))}
            {v.music.enabled && (
              <>
                <div className="flex gap-2">
                  <select className={field} value={v.music.filename} onChange={(e) => setMusic({ filename: e.target.value })}>
                    <option value="">{t.studio.panneaux.choisirAudio}</option>
                    {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <UploadBtn envoiLabel={t.studio.panneaux.envoi} accept="audio/*" label="Uploader" uploadAsset={uploadAsset} onUploaded={(r) => setMusic({ filename: r.filename })} />
                </div>
                <div className="text-xs text-[color:var(--muted)] flex items-center justify-between">
                  <label htmlFor={`${idc}-volume`}>{t.studio.panneaux.volume}</label>
                  <span className="text-[color:var(--ink)]">{Math.round((v.music.volume ?? 0.2) * 100)}%</span>
                </div>
                <input id={`${idc}-volume`} type="range" min="0" max="1" step="0.05" value={v.music.volume ?? 0.2} onChange={(e) => setMusic({ volume: parseFloat(e.target.value) })} className="w-full accent-[var(--accent)]" />
                <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                  <input type="checkbox" checked={v.music.duck} onChange={(e) => setMusic({ duck: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
                  Baisser sous la voix (ducking)
                </label>
              </>
            )}
          </section>

          {/* Voix-off */}
          <section className={sectionCls}>
            {head(<Mic size={15} />, t.studio.panneaux.voixOff, v.voiceover.enabled, (c) => setVoice({ enabled: c }))}
            {v.voiceover.enabled && (
              <>
                <div className="flex gap-2">
                  <select className={field} value={v.voiceover.filename} onChange={(e) => setVoice({ filename: e.target.value })}>
                    <option value="">{t.studio.panneaux.choisirAudio}</option>
                    {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <UploadBtn envoiLabel={t.studio.panneaux.envoi} accept="audio/*" label="Uploader" uploadAsset={uploadAsset} onUploaded={(r) => setVoice({ filename: r.filename })} />
                </div>
                <label className="text-xs text-[color:var(--muted)]">{t.studio.panneaux.depart}</label>
                <input className={field} type="number" min="0" step="0.5" value={v.voiceover.startTime ?? 0} onChange={(e) => setVoice({ startTime: parseFloat(e.target.value) || 0 })} />
              </>
            )}
          </section>

          {/* Images */}
          <section className={sectionCls}>
            {head(<ImageIcon size={15} />, t.studio.panneaux.incrustations, null)}
            {(v.imageOverlays || []).map((im, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <select className={field} value={im.filename} onChange={(e) => updImage(i, { filename: e.target.value })}>
                    <option value="">{t.studio.panneaux.choisirImage}</option>
                    {imageFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <button onClick={() => rmImage(i)} className="p-2 text-[color:var(--muted)] hover:text-[var(--signal)]"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className={field} value={im.position} onChange={(e) => updImage(i, { position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <input className={field} type="number" min="0.05" max="1" step="0.05" value={im.scale} onChange={(e) => updImage(i, { scale: parseFloat(e.target.value) })} title={t.studio.panneaux.tailleZeroUn} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              {imageFiles.length > 0 && (
                <button onClick={addImage} className="flex-1 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <Plus size={15} /> {t.studio.panneaux.imageExistante}
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
            {head(<Layers size={15} />, t.studio.panneaux.habillagesGlobaux, null)}
            
            <div className="flex gap-2">
              {/* Groupé par moment du JT, comme le sélecteur des clips : une
                  liste à plat obligeait à parcourir les huit pour retrouver
                  la barre défilante. */}
              <select
                className={field}
                aria-label={t.studio.interface.ajouterGlobal}
                onChange={(e) => { if (e.target.value) { addOverlay(e.target.value); e.target.value = ''; } }}
              >
                <option value="">{t.studio.interface.ajouterGlobalChoix}</option>
                {MOMENTS_IDS.map((idMoment) => {
                  const liste = habillagesDuMoment(idMoment, GLOBAL_TEMPLATES);
                  if (liste.length === 0) return null;
                  return (
                    <optgroup key={idMoment} label={t.studio.moments[idMoment].label}>
                      {liste.map((m) => (
                        <option key={m.id} value={m.id}>{m.emoji} {t.studio.habillages[m.id].label}</option>
                      ))}
                    </optgroup>
                  );
                })}
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
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-semibold text-sm hover:opacity-90">{t.studio.panneaux.termine}</button>
        </div>
      </div>
  );

  if (inline) return content;

  return (
    <div
      ref={boiteModale} className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      {content}
    </div>
  );
}
