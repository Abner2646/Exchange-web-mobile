"use client"

// src/components/features/HeroSection.jsx (web)
import TopGainersCard from "./TopGainersCard"
import "../../styles/HomePage.css"

const HeroSection = ({ onNavigate, showTopGainers = false, topGainers = [], onCryptoClick, isLoading = false }) => {
  return (
    <section className={`hero-section ${showTopGainers ? "hero-with-gainers" : ""}`}>
      <div className="hero-content">
        <h1 className="hero-title">Tu plataforma definitiva para trading de criptomonedas</h1>
        <p className="hero-subtitle">
          Opera con más de 200 activos digitales de forma segura, rápida y confiable. Únete a miles de traders que ya
          confían en nosotros.
        </p>
        <div className="hero-actions">
          <button
            className="home-action-btn primary"
            onClick={() => onNavigate("/register")}
            style={{
              padding: "var(--spacing-sm) var(--spacing-xl)",
              fontSize: "1rem",
            }}
          >
            Empezar Ahora
          </button>
          <button
            className="home-btn-secondary"
            onClick={() => {
              document.getElementById("markets-section")?.scrollIntoView({
                behavior: "smooth",
              })
            }}
            style={{
              padding: "var(--spacing-sm) var(--spacing-lg)",
            }}
          >
            Ver Mercados
          </button>
        </div>
      </div>

      {showTopGainers && (
        <div className="gainers-section">
          <div className="gainers-container">
            <TopGainersCard gainers={topGainers} onCryptoClick={onCryptoClick} isLoading={isLoading} />
          </div>
        </div>
      )}
    </section>
  )
}

export default HeroSection
