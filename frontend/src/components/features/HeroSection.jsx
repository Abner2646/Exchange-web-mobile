// src/components/features/HeroSection.jsx
import '../../styles/HomePage.css';

const HeroSection = ({ onNavigate }) => {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">
          Tu plataforma definitiva para trading de criptomonedas
        </h1>
        <p className="hero-subtitle">
          Opera con más de 200 activos digitales de forma segura, rápida y confiable. 
          Únete a miles de traders que ya confían en nosotros.
        </p>
        <div className="hero-actions">
          <button
            className="home-action-btn primary"
            onClick={() => onNavigate('/register')}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xxl)',
              fontSize: '1.125rem',
            }}
          >
            Empezar Ahora
          </button>
          <button
            className="home-btn-secondary"
            onClick={() => {
              document.getElementById('markets-section')?.scrollIntoView({ 
                behavior: 'smooth' 
              });
            }}
          >
            Ver Mercados
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;