// src/components/features/HeroSection.jsx
import React from 'react';

const HeroSection = ({ onNavigate }) => {
  const scrollToMarkets = () => {
    document.getElementById('markets-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">Tu Gateway al Futuro de las Criptomonedas</h1>
        <p className="hero-subtitle">
          Opera con confianza en el exchange más seguro y avanzado de Latinoamérica. Accede a las mejores
          criptomonedas con spreads competitivos y tecnología de vanguardia.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => onNavigate('/register')}>
            Comenzar a Operar
          </button>
          <button className="home-btn-secondary" onClick={scrollToMarkets}>
            Ver Mercados
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;