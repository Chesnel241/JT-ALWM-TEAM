import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Layers, Clock, Search } from 'lucide-react';
import { COULEURS } from '../../../../remotion/src/identite.js';
import { OVERLAY_TEMPLATES, CLIP_TEMPLATES, MOMENTS, animationRecommandee, habillagesDuMoment, TEXT_ANIMATIONS_IN, TEXT_ANIMATIONS_LOOP, TEXT_ANIMATIONS_OUT, FONT_FAMILIES } from '../../data/overlayTemplates.js';

function formatTime(s) {
  if (s == null || isNaN(s)) return '0s';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/**
 * Les trois palettes du JT, tirées de la charte.
 *
 * Elles ne sont pas recopiées : `identite.js` est le fichier que lisent aussi
 * le rendu Remotion et le générateur ASS. Un bleu changé là se répercute
 * partout, au lieu de diverger d'une couche à l'autre.
 */
const PALETTES = [
  {
    id: 'jt',
    label: 'JT ALWM',
    colors: { bg: COULEURS.structure, text: COULEURS.papier, accent: COULEURS.accent },
  },
  {
    id: 'alerte',
    label: 'Alerte',
    colors: { bg: COULEURS.alerte, text: COULEURS.papier, accent: COULEURS.papier },
  },
  {
    id: 'sobre',
    label: 'Sobre',
    colors: { bg: COULEURS.encre, text: COULEURS.papier, accent: COULEURS.accent },
  },
];

export function OverlayEditor({ overlay, onChange, onRemove }) {
  const template = OVERLAY_TEMPLATES.find((t) => t.id === overlay.templateId);
  if (!template) return null;

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--paper)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[color:var(--ink)] flex items-center gap-2 text-sm">
          <span>{template.emoji}</span> {template.label}
        </span>
        <button
          onClick={onRemove}
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Text fields */}
      {template.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">{field.label}</label>
          <input
            type="text"
            placeholder={field.placeholder}
            value={overlay.fields?.[field.key] || ''}
            onChange={(e) =>
              onChange({
                ...overlay,
                fields: { ...(overlay.fields || {}), [field.key]: e.target.value },
              })
            }
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] motion-tap"
          />
        </div>
      ))}

      {/* Animations : In / Loop / Out */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Entrée</label>
          <select
            value={overlay.animation || 'fade'}
            onChange={(e) => onChange({ ...overlay, animation: e.target.value })}
            className="w-full px-2 py-1.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-md text-[11px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]"
          >
            {TEXT_ANIMATIONS_IN.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Continue</label>
          <select
            value={overlay.animationLoop || 'none'}
            onChange={(e) => onChange({ ...overlay, animationLoop: e.target.value })}
            className="w-full px-2 py-1.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-md text-[11px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]"
          >
            {TEXT_ANIMATIONS_LOOP.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Sortie</label>
          <select
            value={overlay.animationOut || 'fade'}
            onChange={(e) => onChange({ ...overlay, animationOut: e.target.value })}
            className="w-full px-2 py-1.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-md text-[11px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]"
          >
            {TEXT_ANIMATIONS_OUT.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Police, Taille et Interligne */}
      <div className="space-y-3 p-3 bg-[var(--paper-2)] rounded-xl border border-[var(--border)]">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-wider">Police de caractères</label>
          <select
            value={overlay.font || ''}
            onChange={(e) => onChange({ ...overlay, font: e.target.value || undefined })}
            className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-lg text-sm font-medium text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] motion-tap"
          >
            <option value="">Par défaut (Système)</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* « Interligne » vivait ici. Le curseur écrivait la valeur, le
            serveur la validait, et aucun moteur de rendu ne la lisait : ni
            Remotion, ni libass. Un réglage qui ne fait rien coûte plus qu'il
            ne rapporte. L'interligne reviendra avec l'échelle typographique
            du JT, appliquée à tous les habillages. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="overlay-taille" className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wider">Taille</label>
            <span className="text-[10px] font-mono font-bold text-[color:var(--ink)]">{overlay.fontSize || 100}%</span>
          </div>
          <input
            id="overlay-taille"
            type="range"
            min="50"
            max="250"
            step="5"
            value={overlay.fontSize || 100}
            onChange={(e) => onChange({ ...overlay, fontSize: parseInt(e.target.value, 10) || 100 })}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      </div>

      {/* Palettes Thématiques TV & Couleurs personnalisées */}
      <div className="space-y-2.5 p-3 bg-[var(--paper-2)] rounded-xl border border-[var(--border)]">
        <label className="text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-wider block">Couleurs</label>
        {/* Cinq thèmes inventés vivaient ici — « ALWM Signature » était un or
            sur ardoise, sans rapport avec la marque. Les trois qui restent
            viennent de la charte du JT (remotion/src/identite.js), la même
            que celle du rendu et du repli libass. La couleur y est nommée par
            son rôle, et l'intitulé ne repose plus sur un emoji seul. */}
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange({ ...overlay, colors: { ...(overlay.colors || {}), ...theme.colors } })}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--paper)] hover:bg-[var(--accent)]/10 text-[color:var(--ink)] border border-[var(--border)] active:scale-95 motion-tap"
            >
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full border border-[var(--border)]"
                style={{ background: theme.colors.bg }}
              />
              {theme.label}
            </button>
          ))}
        </div>

        {/* 3 slots manuels : texte / fond / accent */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            ['text', 'Texte'],
            ['bg', 'Fond'],
            ['accent', 'Accent'],
          ].map(([k, lab]) => (
            <div key={k} className="flex items-center justify-between gap-1 border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--paper)]">
              <span className="text-[11px] font-medium text-[color:var(--muted)]">{lab}</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={(overlay.colors && overlay.colors[k]) || '#000000'}
                  onChange={(e) => onChange({ ...overlay, colors: { ...(overlay.colors || {}), [k]: e.target.value } })}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  title={`Couleur ${lab}`}
                />
                {overlay.colors && overlay.colors[k] && (
                  <button
                    onClick={() => { const c = { ...(overlay.colors || {}) }; delete c[k]; onChange({ ...overlay, colors: c }); }}
                    className="text-[10px] text-[color:var(--muted)] hover:text-[var(--signal)] font-bold"
                    title="Réinitialiser"
                  >×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contour + halo (gravés par libass \bord + \blur) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Contour : {overlay.outline ?? 0}</label>
          <input type="range" min="0" max="6" step="1" value={overlay.outline ?? 0}
            onChange={(e) => onChange({ ...overlay, outline: parseInt(e.target.value, 10) || 0 })}
            className="w-full accent-[var(--accent)]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Halo : {overlay.glow ?? 0}</label>
          <input type="range" min="0" max="10" step="1" value={overlay.glow ?? 0}
            onChange={(e) => onChange({ ...overlay, glow: parseInt(e.target.value, 10) || 0 })}
            className="w-full accent-[var(--accent)]" />
        </div>
      </div>

      {/* Transform controls */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Position X : {overlay.posX ?? 0}</label>
          <input type="range" min="-1920" max="1920" step="10" value={overlay.posX ?? 0}
            onChange={(e) => onChange({ ...overlay, posX: parseInt(e.target.value, 10) || 0 })}
            className="w-full accent-[var(--accent)]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Position Y : {overlay.posY ?? 0}</label>
          <input type="range" min="-1080" max="1080" step="10" value={overlay.posY ?? 0}
            onChange={(e) => onChange({ ...overlay, posY: parseInt(e.target.value, 10) || 0 })}
            className="w-full accent-[var(--accent)]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[color:var(--muted)] uppercase tracking-wider">Taille : {overlay.scale ?? 100}%</label>
          <input type="range" min="10" max="300" step="5" value={overlay.scale ?? 100}
            onChange={(e) => onChange({ ...overlay, scale: parseInt(e.target.value, 10) || 100 })}
            className="w-full accent-[var(--accent)]" />
        </div>
      </div>

      {/* Timing controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)] flex items-center gap-1">
            <Clock size={11} /> Début (s)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={overlay.startTime ?? 0}
            onChange={(e) => onChange({ ...overlay, startTime: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] motion-tap"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Durée (s, vide = toute la vidéo)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            placeholder="∞"
            value={overlay.duration ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...overlay, duration: v === '' ? null : parseFloat(v) });
            }}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] motion-tap"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Choisir un habillage parmi vingt-trois, sous la pression du bouclage.
 *
 * Ils s'affichaient en une seule liste rangée par portée technique — « clip »
 * ou « global » —, c'est-à-dire par un détail d'implémentation que le monteur
 * n'a aucune raison de connaître. Il fallait parcourir les vingt-trois pour
 * retrouver le bandeau nom.
 *
 * Ici ils sont rangés par moment du JT, dans l'ordre où ces moments arrivent à
 * l'antenne, et une recherche filtre sur le nom comme sur la description : un
 * monteur qui tape « alerte » ou « citation » arrive en un geste.
 */
export function SelecteurHabillage({ modeles, onChoisir, onAnnuler }) {
  const [recherche, setRecherche] = useState('');

  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const correspond = (t, moment) =>
      !q
      || (t.label || '').toLowerCase().includes(q)
      || (t.preview || '').toLowerCase().includes(q)
      || moment.label.toLowerCase().includes(q)
      || moment.aide.toLowerCase().includes(q);

    return MOMENTS
      .map((moment) => ({ moment, liste: habillagesDuMoment(moment.id, modeles).filter((t) => correspond(t, moment)) }))
      .filter((g) => g.liste.length > 0);
  }, [recherche, modeles]);

  const total = groupes.reduce((n, g) => n + g.liste.length, 0);

  return (
    <div className="border border-[var(--accent)]/40 rounded-xl p-4 bg-[var(--accent)]/5 flex flex-col gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-lg">
        <Search size={14} className="text-[color:var(--muted)] shrink-0" aria-hidden="true" />
        <input
          id="recherche-habillage"
          type="search"
          autoFocus
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un habillage…"
          aria-label="Chercher un habillage"
          className="w-full bg-transparent text-sm text-[color:var(--ink)] placeholder:text-[color:var(--muted)] focus:outline-none"
        />
      </div>

      {total === 0 && (
        <p className="text-xs text-[color:var(--muted)] text-center py-4">
          Aucun habillage ne correspond à « {recherche} ».
        </p>
      )}

      {groupes.map(({ moment, liste }) => (
        <div key={moment.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 px-0.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent)]">{moment.label}</h3>
            <p className="text-[10px] text-[color:var(--muted)] truncate">{moment.aide}</p>
          </div>
          {liste.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChoisir(t.id)}
              className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 motion-tap text-left"
            >
              <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[color:var(--ink)]">{t.label}</p>
                <p className="text-xs text-[color:var(--muted)]">{t.preview}</p>
              </div>
            </button>
          ))}
        </div>
      ))}

      <button
        type="button"
        onClick={onAnnuler}
        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--ink)] text-center mt-1 transition-colors"
      >
        Annuler
      </button>
    </div>
  );
}

export default function OverlayPanel({ clip, onClose, onSave, onChangePreview, inline = false }) {
  const [overlays, setOverlays] = useState(clip.overlays || []);
  const [picking, setPicking] = useState(false);

  // Trigger real-time preview
  useEffect(() => {
    if (onChangePreview) {
      onChangePreview({ ...clip, overlays });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays]);

  const addOverlay = (templateId) => {
    setOverlays([
      ...overlays,
      {
        id: `${templateId}-${Date.now()}`,
        templateId,
        fields: {},
        // Tout habillage naissait en « Fondu », quel qu'il soit : le monteur
        // corrigeait à chaque fois, ou livrait vingt-trois fondus. Le défaut
        // dépend maintenant du moment du JT, et le menu reste entier.
        animation: animationRecommandee(templateId),
        startTime: 0,
        duration: null,
      },
    ]);
    setPicking(false);
  };

  const updateOverlay = (idx, updated) => {
    const copy = [...overlays];
    copy[idx] = updated;
    setOverlays(copy);
  };

  const removeOverlay = (idx) => {
    setOverlays(overlays.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({ ...clip, overlays });
    onClose();
  };

  const content = (
    <div className={`bg-[var(--paper)] w-full flex flex-col overflow-hidden ${inline ? 'h-full border-l border-[var(--border)]' : 'rounded-2xl max-w-lg shadow-2xl border border-[var(--border)] max-h-[90vh] animate-in fade-in zoom-in-95 duration-200'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Layers className="text-[var(--accent)]" size={18} />
            Animations & Habillage
          </h2>
          <p className="text-xs text-[color:var(--muted)] truncate max-w-[150px]">{clip.name}</p>
          <button
            onClick={onClose}
            className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {overlays.length === 0 && !picking && (
            <div className="text-center py-8 text-[color:var(--muted)]">
              <Layers size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune animation pour ce clip.</p>
              <p className="text-xs mt-1">Cliquez sur "Ajouter une animation" ci-dessous.</p>
            </div>
          )}

          {overlays.map((overlay, idx) => (
            <OverlayEditor
              key={overlay.id}
              overlay={overlay}
              onChange={(updated) => updateOverlay(idx, updated)}
              onRemove={() => removeOverlay(idx)}
            />
          ))}

          {/* Sélecteur d'habillage */}
          {picking ? (
            <SelecteurHabillage modeles={CLIP_TEMPLATES} onChoisir={addOverlay} onAnnuler={() => setPicking(false)} />
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent)] transition-colors"
            >
              <Plus size={16} />
              Ajouter une animation
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)] text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[color:var(--paper)] font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Layers size={15} />
            Appliquer ({overlays.length} animation{overlays.length !== 1 ? 's' : ''})
          </button>
        </div>
    </div>
  );
  if (inline) return content;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>
  );
}
