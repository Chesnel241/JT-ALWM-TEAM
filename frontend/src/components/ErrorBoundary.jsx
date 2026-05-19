import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)]">
          <div className="max-w-md w-full text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)] mb-2">
              Oups! Une erreur est survenue
            </h1>
            <p className="text-[color:var(--muted)] mb-6">
              L'application a rencontré un problème inattendu. Veuillez rafraîchir la page et réessayer.
            </p>
            <button
              onClick={() => window.location.reload()}
              type="button"
              className="btn btn-primary"
            >
              Rafraîchir la page
            </button>
            <p className="text-xs text-[color:var(--muted)] mt-6">
              Si le problème persiste, contactez l'administrateur.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
