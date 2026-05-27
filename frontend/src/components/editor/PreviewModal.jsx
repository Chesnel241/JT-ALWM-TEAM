import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause } from 'lucide-react';
import { API_BASE } from '../../api/index.js';

// Aperçu temps réel DOM/CSS de la timeline : joue les clips en séquence (trim
// respecté), recrée les overlays / habillage en CSS (≈90% fidèle au master),
// fondu aux transitions, audio du clip. Pas de rendu serveur.

const fileUrl = (filename) => `${API_BASE}/uploads/${filename}`;

function probeDuration(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => resolve(0);
  });
}

const COL = { navy: '#14143C', gold: '#FFD700', red: '#D81818', blue: '#0046C0', ink: '#1A1A1A', dark: '#1A1A2E' };

// Classe d'animation d'entrée selon overlay.animation.
const animClass = (a) => ({
  slide: 'pv-slideL', scale: 'pv-scale', sweep: 'pv-fade', typewriter: 'pv-fade', fade: 'pv-fade',
}[a] || 'pv-fade');

// Rendu CSS approximatif d'un overlay (par templateId).
function OverlayChip({ templateId, fields = {}, animation }) {
  const f = fields;
  const ac = animClass(animation);
  const base = { position: 'absolute', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.1, whiteSpace: 'nowrap' };
  switch (templateId) {
    case 'lower_third':
      return (
        <div className={ac} style={{ ...base, left: '2%', bottom: '6%' }}>
          <div style={{ background: COL.navy, opacity: 0.86, borderLeft: `4px solid ${COL.gold}`, padding: '6px 18px' }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.5em' }}>{f.name}</div>
            <div style={{ color: COL.gold, fontSize: '0.95em' }}>{f.title}</div>
          </div>
        </div>
      );
    case 'lower_third_pro':
      return (
        <div className={ac} style={{ ...base, left: '3%', bottom: '7%' }}>
          <div style={{ background: '#fff', color: COL.ink, fontFamily: 'Archivo Black, Inter, sans-serif', fontWeight: 900, fontSize: '1.5em', padding: '6px 18px', borderLeft: `5px solid ${COL.blue}` }}>{f.titre}</div>
          <div style={{ background: COL.blue, color: '#fff', fontWeight: 700, fontSize: '1em', padding: '5px 18px', display: 'inline-block' }}>{f.sous_titre}</div>
        </div>
      );
    case 'grand_titre':
      return (
        <div className={ac} style={{ ...base, left: 0, right: 0, top: '40%', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,.6)', padding: '14px 0' }}>
            <div style={{ color: '#fff', fontFamily: 'Anton, Inter, sans-serif', fontSize: '2.6em' }}>{f.title}</div>
            <div style={{ color: COL.gold, fontFamily: 'Bebas Neue, Inter, sans-serif', fontSize: '1.3em', letterSpacing: 1 }}>{f.date}</div>
          </div>
        </div>
      );
    case 'titre_karaoke':
      return (
        <div className={ac} style={{ ...base, left: 0, right: 0, top: '48%', textAlign: 'center' }}>
          <div style={{ borderTop: `3px solid ${COL.gold}`, background: 'rgba(0,0,0,.55)', padding: '16px 0', color: '#fff', fontFamily: 'Anton, Inter, sans-serif', fontSize: '2.4em' }}>{f.title}</div>
        </div>
      );
    case 'titre_reportage':
      return (
        <div className={ac} style={{ ...base, left: 0, bottom: '7%' }}>
          <div style={{ background: COL.dark, opacity: 0.92, borderLeft: `5px solid ${COL.gold}`, color: '#fff', fontWeight: 800, fontSize: '1.4em', padding: '8px 20px' }}>{f.sujet}</div>
        </div>
      );
    case 'sous_titre':
      return (
        <div className={ac} style={{ ...base, left: 0, right: 0, bottom: '6%', textAlign: 'center' }}>
          <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: '1.3em', padding: '6px 16px' }}>{f.texte}</span>
        </div>
      );
    case 'bandeau_pays':
      return (
        <div className={`${ac}`} style={{ ...base, right: '2%', top: '3%' }}>
          <div style={{ background: COL.red, color: '#fff', fontFamily: 'Bebas Neue, Inter, sans-serif', fontSize: '1.6em', padding: '4px 16px', borderBottom: `3px solid ${COL.gold}` }}>{f.pays}</div>
        </div>
      );
    case 'flash_info':
      return (
        <div className="pv-fade" style={{ ...base, left: 0, right: 0, top: 0, display: 'flex' }}>
          <div style={{ background: '#000', color: '#fff', fontFamily: 'Anton, Inter, sans-serif', fontSize: '1.4em', padding: '8px 18px' }}>FLASH</div>
          <div style={{ background: COL.red, color: '#fff', fontWeight: 800, fontSize: '1.3em', padding: '8px 18px', flex: 1 }}>{f.texte}</div>
        </div>
      );
    case 'breaking_news':
      return (
        <div className="pv-fade" style={{ ...base, left: '3%', top: '14%' }}>
          <div style={{ background: COL.red, color: '#fff', fontFamily: 'Anton, Inter, sans-serif', fontSize: '2.2em', padding: '6px 40px', transform: 'skewX(-12deg)' }}>
            <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{f.titre || 'DERNIÈRE MINUTE'}</span>
          </div>
          <div style={{ background: '#fff', color: COL.ink, fontWeight: 800, fontSize: '1.3em', padding: '6px 18px', marginTop: 8, display: 'inline-block' }}>{f.sujet}</div>
        </div>
      );
    case 'score_resultat':
      return (
        <div className="pv-drop" style={{ ...base, left: 0, right: 0, top: '3%', textAlign: 'center' }}>
          <span style={{ background: COL.navy, color: '#fff', padding: '8px 22px', fontFamily: 'Bebas Neue, Inter, sans-serif', fontSize: '1.6em' }}>
            {f.gauche} <span style={{ color: COL.gold, fontFamily: 'Anton, Inter' }}>{f.score}</span> {f.droite}
          </span>
        </div>
      );
    case 'horloge_date':
      return (
        <div className="pv-slideL" style={{ ...base, left: '2%', top: '3%', display: 'flex', alignItems: 'center', background: COL.red, padding: '4px 14px' }}>
          <span style={{ color: '#fff', fontFamily: 'Bebas Neue, Inter, sans-serif', fontSize: '1.5em' }}>{f.heure}</span>
          <span style={{ color: COL.gold, fontSize: '0.85em', marginLeft: 10 }}>{f.date}</span>
        </div>
      );
    default:
      return null;
  }
}

export default function PreviewModal({ clips, branding, onClose }) {
  const videoRef = useRef(null);
  const seekRef = useRef(null); // in-point à appliquer après loadedmetadata
  const [segs, setSegs] = useState(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [fade, setFade] = useState(false);

  // Construit les segments (durées via metadata si pas de outPoint).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = [];
      let acc = 0;
      for (const c of clips) {
        const inP = c.inPoint ?? 0;
        let dur = c.outPoint != null ? c.outPoint - inP : (await probeDuration(fileUrl(c.filename))) - inP;
        dur = Math.max(0.3, dur || 1);
        out.push({ clip: c, in: inP, out: inP + dur, dur, start: acc });
        acc += dur;
      }
      if (!cancelled) setSegs(out);
    })();
    return () => { cancelled = true; };
  }, [clips]);

  const total = segs && segs.length ? segs[segs.length - 1].start + segs[segs.length - 1].dur : 0;

  // Charge la vidéo du segment courant.
  useEffect(() => {
    if (!segs || !segs[idx]) return;
    const v = videoRef.current;
    if (!v) return;
    seekRef.current = segs[idx].in;
    v.src = fileUrl(segs[idx].clip.filename);
    v.load();
  }, [idx, segs]);

  const onLoadedMeta = () => {
    const v = videoRef.current;
    if (v && seekRef.current != null) { try { v.currentTime = seekRef.current; } catch { /* ignore */ } }
    if (playing) v?.play().catch(() => {});
  };

  const advance = useCallback(() => {
    if (!segs) return;
    if (idx < segs.length - 1) {
      if (segs[idx].clip.transition) { setFade(true); setTimeout(() => setFade(false), 350); }
      setIdx((i) => i + 1);
    } else {
      setPlaying(false);
      videoRef.current?.pause();
      setT(total);
    }
  }, [segs, idx, total]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    const s = segs?.[idx];
    if (!v || !s) return;
    setT(s.start + Math.max(0, v.currentTime - s.in));
    if (v.currentTime >= s.out - 0.04) advance();
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seekGlobal = (gt) => {
    if (!segs) return;
    const s = segs.find((x) => gt >= x.start && gt < x.start + x.dur) || segs[segs.length - 1];
    const local = s.in + (gt - s.start);
    if (segs.indexOf(s) !== idx) { seekRef.current = local; setIdx(segs.indexOf(s)); }
    else { try { videoRef.current.currentTime = local; } catch { /* ignore */ } }
    setT(gt);
  };

  // Overlays actifs du clip courant (timing local).
  const seg = segs?.[idx];
  const clipLocal = seg ? Math.max(0, (t - seg.start)) : 0;
  const activeOverlays = (seg?.clip.overlays || []).filter((o) => {
    const st = o.startTime ?? 0;
    const en = st + (o.duration != null ? o.duration : 1e9);
    return clipLocal >= st && clipLocal <= en;
  });

  // Sous-titre actif (timings relatifs au fichier d'origine).
  const inP = seg?.in ?? 0;
  const activeSub = (seg?.clip.subtitles || []).find((s) => {
    const rel = clipLocal + inP;
    return rel >= s.start && rel <= s.end && s.text;
  });
  const subPos = seg?.clip.subtitleStyle?.position === 'top' ? { top: '6%' } : { bottom: '14%' };

  const tk = branding?.ticker?.enabled && branding.ticker.texte ? branding.ticker : null;
  const live = branding?.live?.enabled ? branding.live : null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style>{`
        @keyframes pvFade{from{opacity:0}to{opacity:1}}
        @keyframes pvSlideL{from{transform:translateX(-120%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pvScale{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes pvDrop{from{transform:translateY(-130%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pvTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes pvPulse{0%,100%{opacity:1}50%{opacity:.5}}
        .pv-fade{animation:pvFade .35s ease both}
        .pv-slideL{animation:pvSlideL .45s ease both}
        .pv-scale{animation:pvScale .4s ease both}
        .pv-drop{animation:pvDrop .4s ease both}
      `}</style>
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] text-base">Aperçu temps réel</h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg"><X size={18} /></button>
        </div>

        {/* Scène 16:9 */}
        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transition: 'opacity .3s', opacity: fade ? 0 : 1 }}
            onLoadedMetadata={onLoadedMeta}
            onTimeUpdate={onTimeUpdate}
            onEnded={advance}
            playsInline
          />

          {/* Overlays du clip */}
          {activeOverlays.map((o, i) => (
            <OverlayChip key={`${o.id || o.templateId}-${i}-${idx}`} templateId={o.templateId} fields={o.fields} animation={o.animation} />
          ))}

          {/* Sous-titre */}
          {activeSub && (
            <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', ...subPos }}>
              <span style={{ background: 'rgba(0,0,0,.6)', color: '#fff', fontWeight: 600, fontSize: '1.2em', padding: '4px 14px', textShadow: '0 1px 2px #000' }}>{activeSub.text}</span>
            </div>
          )}

          {/* Habillage global */}
          {live && (
            <div style={{ position: 'absolute', right: '2%', top: '3%', background: COL.red, color: '#fff', fontWeight: 800, fontSize: '0.9em', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, animation: 'pvPulse 1.4s infinite' }}>
              <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} /> {live.label || 'LIVE'}
            </div>
          )}
          {branding?.logo && (
            <img src="/logo-lwm.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', right: '3%', bottom: '14%', height: '12%', opacity: 0.9 }} />
          )}
          {tk && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '11%', background: 'rgba(10,26,47,.95)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              {tk.categorie && <span style={{ background: COL.red, color: '#fff', fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0 }}>{tk.categorie}</span>}
              <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'pvTicker 18s linear infinite' }}>
                <span style={{ color: '#fff', padding: '0 30px' }}>{tk.texte}</span>
                <span style={{ color: '#fff', padding: '0 30px' }}>{tk.texte}</span>
              </div>
            </div>
          )}

          {!segs && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Chargement de l'aperçu…</div>}
        </div>

        {/* Contrôles */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button onClick={toggle} className="p-2 rounded-full bg-[var(--ink)] text-[var(--paper)]" disabled={!segs}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <input type="range" min="0" max={total || 0} step="0.05" value={Math.min(t, total)} onChange={(e) => seekGlobal(parseFloat(e.target.value))} className="flex-1 accent-[var(--accent)]" disabled={!segs} />
          <span className="text-xs tabular-nums text-[color:var(--muted)] w-20 text-right">{t.toFixed(1)} / {total.toFixed(1)}s</span>
        </div>
        <p className="px-5 pb-3 text-[11px] text-[color:var(--muted)]">Aperçu indicatif (rendu CSS) — le master final est en pleine qualité. Le mix musique/voix-off n'est pas joué ici.</p>
      </div>
    </div>
  );
}
