import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';

const baseFontConfig = {
  fontFamily: 'var(--ov-font, "Montserrat ExtraBold"), "Montserrat ExtraBold", system-ui, sans-serif',
  textTransform: 'uppercase',
  fontWeight: '900',
  lineHeight: 1,
  margin: 0,
};

/**
 * Coupe un titre en deux lignes pour un habillage qui en attend deux.
 *
 * Un retour à la ligne explicite fait foi. Sinon on coupe à la frontière de
 * mot la plus proche du milieu, ce qui évite la ligne d'un seul mot qu'un
 * découpage à la moitié des caractères produit régulièrement.
 */
export function deuxLignes(titre) {
  const t = String(titre || '').trim();
  if (!t) return ['', ''];

  const explicite = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (explicite.length > 1) return [explicite[0], explicite.slice(1).join(' ')];

  const mots = t.split(/\s+/);
  if (mots.length < 2) return [t, ''];

  const milieu = t.length / 2;
  let coupe = 1;
  let meilleur = Infinity;
  for (let i = 1; i < mots.length; i += 1) {
    const ecart = Math.abs(mots.slice(0, i).join(' ').length - milieu);
    if (ecart < meilleur) { meilleur = ecart; coupe = i; }
  }
  return [mots.slice(0, coupe).join(' '), mots.slice(coupe).join(' ')];
}

export function EnvatoBigTitle({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  // Le catalogue déclare un champ « titre » ; ce composant lisait line1 /
  // line2 / subtitle. Ce que le monteur tapait n'arrivait donc nulle part, et
  // le JT partait à l'antenne avec le texte de démonstration du fournisseur :
  // « WHAT IS GOING ON IN THE WORLD ». On lit désormais le champ déclaré, en
  // gardant les trois anciens noms pour les montages déjà enregistrés.
  const [titreL1, titreL2] = deuxLignes(fields.titre);
  const line1 = fields.line1 || titreL1 || 'TITRE DU JOURNAL';
  const line2 = fields.line2 || titreL2 || '';
  const subtitle = fields.subtitle || fields.sous_titre || '';
  const colorMain = fields.colorMain || '#d61f1f';
  const colorAccent = fields.colorAccent || '#fcfcfc';
  const colorTextMain = fields.colorTextMain || '#fcfcfc';
  const colorTextAccent = fields.colorTextAccent || '#111111';

  // Out phase logic
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 60) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  // Intro scaling effect for premium Polish (compound unseen details)
  // Starts at 0.95 scale and softly reaches 1.0 for a natural entrance.
  const introEase = getExpEaseOut(frame, 0, 40);
  const introScale = 0.95 + (introEase * 0.05); 

  return (
     <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${outY}px) scale(${introScale})`,
        opacity: outOpacity,
        willChange: 'transform, opacity'
     }}>
        {/* We stagger the reveals for a dynamic cascading entrance */}
        <div style={{ transform: 'skewX(-10deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            <EnvatoMaskReveal frame={frame} delay={5} direction="right" duration={30}>
              <div style={{ backgroundColor: colorAccent, padding: '24px 64px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', marginBottom: '4px' }}>
                <div style={{ transform: 'skewX(10deg)' }}> {/* Unskew text so only box is skewed */}
                    <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={25}>
                      <div style={{ ...baseFontConfig, fontSize: '90px', color: colorTextAccent, letterSpacing: '-2px' }}>
                        {line1}
                      </div>
                    </EnvatoMaskReveal>
                </div>
              </div>
            </EnvatoMaskReveal>

            {/* Un titre court tient sur une ligne : sans ce garde, la seconde
                bande s'afficherait quand même, en aplat de couleur vide. */}
            {line2 && (
            <EnvatoMaskReveal frame={frame} delay={12} direction="left" duration={30}>
              <div style={{ backgroundColor: colorAccent, padding: '24px 64px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ transform: 'skewX(10deg)' }}>
                    <EnvatoMaskReveal frame={frame} delay={27} direction="bottom" duration={25}>
                      <div style={{ ...baseFontConfig, fontSize: '90px', color: colorTextAccent, letterSpacing: '-2px' }}>
                        {line2}
                      </div>
                    </EnvatoMaskReveal>
                </div>
              </div>
            </EnvatoMaskReveal>
            )}
            
            {subtitle && (
                <EnvatoMaskReveal frame={frame} delay={24} direction="right" duration={30} style={{ marginTop: '-12px', zIndex: 10 }}>
                  <div style={{ backgroundColor: colorMain, padding: '16px 48px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ transform: 'skewX(10deg)' }}>
                        <EnvatoMaskReveal frame={frame} delay={39} direction="top" duration={25}>
                          <div style={{ ...baseFontConfig, fontSize: '36px', color: colorTextMain, letterSpacing: '4px' }}>
                            {subtitle}
                          </div>
                        </EnvatoMaskReveal>
                    </div>
                  </div>
                </EnvatoMaskReveal>
            )}
        </div>
     </div>
  );
}

export function EnvatoTicker({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const tag = fields.tag || 'LIVE';
  // Même défaut que le Grand Titre : le catalogue déclare text1 et text2, le
  // composant ne lisait que `items`. Les deux informations saisies par le
  // monteur étaient ignorées au profit des titres de démonstration anglais.
  let items = fields.items || [fields.text1, fields.text2].filter(Boolean);
  if (typeof items === 'string') items = items.split(',').map(s => s.trim());
  if (!items.length) items = ['INFORMATION À SAISIR'];
  const colorMain = fields.colorMain || '#d61f1f';
  const colorAccent = fields.colorAccent || '#111111';
  const colorTextMain = fields.colorTextMain || '#fcfcfc';
  const colorTextAccent = fields.colorTextAccent || '#fcfcfc';

  const isOut = frame > durationInFrames - 20;
  const outFrame = isOut ? frame - (durationInFrames - 20) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 64) : 0;

  // Repeat items for a continuous ticker tape effect
  const separator = '   ///   ';
  const tickerText = [...items, ...items, ...items, ...items, ...items].join(separator);
  
  // Ticker scrolls to the left continuously.
  const speed = 4;
  const translateX = -(frame * speed); 

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '64px',
      display: 'flex',
      transform: `translateY(${outY}px)`,
      willChange: 'transform'
    }}>
      {/* Ticker Tape */}
      <EnvatoMaskReveal frame={frame} delay={0} direction="right" duration={25} style={{ flex: 1, width: '100%' }}>
        <div style={{ backgroundColor: colorAccent, height: '100%', width: '100%', display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                left: '200px', // Starts just behind the LIVE tag
                whiteSpace: 'nowrap',
                transform: `translateX(${translateX}px)`,
                ...baseFontConfig,
                fontSize: '28px',
                color: colorTextAccent,
                fontWeight: '600',
                letterSpacing: '1px'
            }}>
                {tickerText}
            </div>
        </div>
      </EnvatoMaskReveal>

      {/* Live Tag Overlay */}
      <EnvatoMaskReveal frame={frame} delay={10} direction="right" duration={20} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ backgroundColor: colorMain, height: '100%', padding: '0 48px', display: 'flex', alignItems: 'center', boxShadow: '10px 0 30px rgba(0,0,0,0.5)' }}>
           <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={20}>
             <div style={{ ...baseFontConfig, fontSize: '32px', color: colorTextMain, fontWeight: '800' }}>
               {tag}
             </div>
           </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  )
}
