// src/components/features/FeaturesSection.jsx
import {
  BuildingOfficeIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

const FeaturesSection = () => {
  return (
    <section className="features-section">
      <h2 className="section-title">¿Por qué somos la compañía más confiable?</h2>
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <BuildingOfficeIcon className="icon-size" />
          </div>
          <h3>La empresa crypto pública más grande del mundo</h3>
          <p>Operamos con transparencia financiera.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <ShieldCheckIcon className="icon-size" />
          </div>
          <h3>Tus activos están protegidos</h3>
          <p>Nuestras medidas de gestión de riesgos están diseñadas para proteger tus activos.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <LockClosedIcon className="icon-size" />
          </div>
          <h3>Funcionalidades de seguridad avanzadas</h3>
          <p>Utilizamos las mejores prácticas de la industria para aumentar la seguridad de nuestra plataforma.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <UserCircleIcon className="icon-size" />
          </div>
          <h3>Respetamos tu privacidad</h3>
          <p>
            Solo recopilamos los datos personales para brindarte la mejor protección y los mejores servicios
            posibles.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;