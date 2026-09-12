import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
