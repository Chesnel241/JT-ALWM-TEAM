import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

/**
 * Combien de temps un message reste affiché.
 *
 * L'INCIDENT : chaque message disparaissait au bout de 3 s, quelle que soit
 * la durée demandée — le composant posait son propre minuteur. Un
 * correspondant qui lisait lentement « Envoi impossible : … » ne voyait
 * qu'un éclair rouge. Une erreur reste donc affichée jusqu'à ce qu'on la
 * ferme, quelle que soit la durée passée ; les autres messages durent ce
 * qu'on demande, 4 s par défaut.
 */
export function dureeAffichage(type, duree) {
  if (type === 'error') return 0;
  return typeof duree === 'number' ? duree : 4000;
}

/** Au-delà, les plus anciens partent : des erreurs persistantes s'empileraient. */
const MAX_VISIBLES = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const minuteurs = useRef(new Map());

  const removeToast = useCallback((id) => {
    const minuteur = minuteurs.current.get(id);
    if (minuteur) {
      clearTimeout(minuteur);
      minuteurs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Arguments : message, type, durée, puis `{ action }`.
   * `durée` : en millisecondes ; 0 = jusqu'à ce qu'on le ferme ; omise = selon le type.
   * `action` : `{ libelle, onClick }`, un bouton dans le message (« Annuler »…).
   */
  const addToast = useCallback((message, type = 'info', duration = undefined, options = {}) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, message, type, action: options?.action || null };

    // Le même message répété (une sauvegarde qui échoue à chaque geste hors
    // connexion) remplace le précédent au lieu de s'empiler.
    setToasts((prev) => [
      ...prev.filter((t) => !(t.message === message && t.type === type)),
      toast,
    ].slice(-MAX_VISIBLES));

    const duree = dureeAffichage(type, duration);
    if (duree > 0) {
      minuteurs.current.set(id, setTimeout(() => {
        minuteurs.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duree));
    }

    return id;
  }, []);

  useEffect(() => () => {
    for (const minuteur of minuteurs.current.values()) clearTimeout(minuteur);
  }, []);

  // Sans mémorisation, chaque toast affiché crée un nouvel objet de contexte et
  // re-rend TOUS les consommateurs, y compris le tableau de bord de montage.
  const value = useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Un message affiché en passant n'est pas une raison de faire tomber son
// parent. Les composants feuilles montés un peu partout — la cloche des
// notifications dans la barre de navigation, par exemple — ne doivent pas
// imposer un fournisseur à tous leurs hôtes : sans lui, le message n'est
// simplement pas affiché, et l'écran continue de fonctionner.
const SANS_FOURNISSEUR = Object.freeze({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useOptionalToast() {
  return useContext(ToastContext) || SANS_FOURNISSEUR;
}
