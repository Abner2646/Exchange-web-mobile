// src/components/features/FeaturesSection.jsx
import {
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ClockIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const FeaturesSection = () => {
  return (
    <section className="features-section">
      <h2 className="section-title">¿Por qué elegirnos?</h2>
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <CurrencyDollarIcon className="icon-size" />
          </div>
          <h3>Comisiones ultra competitivas</h3>
          <p>Opera con las comisiones más bajas del mercado. Sin sorpresas, sin costos ocultos.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <ShieldCheckIcon className="icon-size" />
          </div>
          <h3>Seguridad de nivel institucional</h3>
          <p>Tus fondos protegidos con tecnología de última generación y cold storage.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <ClockIcon className="icon-size" />
          </div>
          <h3>Soporte 24/7 en español</h3>
          <p>Nuestro equipo está disponible todo el día, todos los días para ayudarte.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <UserGroupIcon className="icon-size" />
          </div>
          <h3>Comunidad activa y confiable</h3>
          <p>
            Únete a una comunidad de traders comprometidos con el crecimiento y el aprendizaje continuo.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;