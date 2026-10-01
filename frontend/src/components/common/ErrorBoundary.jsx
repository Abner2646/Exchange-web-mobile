// Error boundary de la app: evita la "pantalla en blanco" cuando un componente crashea al renderizar.
// En vez del fondo vacío, muestra el error (mensaje + stack) para poder diagnosticar la beta, y un
// botón para recargar. Captura cualquier excepción de render en el árbol que envuelve.
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en la consola del browser para debugging.
    // eslint-disable-next-line no-console
    console.error('💥 UI crash capturado por ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      const detail = (e && (e.stack || e.message)) || String(e);
      return (
        <div style={{
          padding: 24, minHeight: '100vh', background: '#0f1115', color: '#e6e6e6',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          <h2 style={{ color: '#ff8080' }}>Se rompió la interfaz 😕</h2>
          <p>Probá recargar. Si sigue pasando, copiá este detalle y mandáselo al equipo:</p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#ffb3b3',
            background: '#1a1d24', padding: 16, borderRadius: 8, maxHeight: '50vh', overflow: 'auto',
          }}>{detail}</pre>
          <button
            onClick={() => window.location.assign('/')}
            style={{ marginTop: 16, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
