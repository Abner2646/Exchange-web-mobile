// src/components/features/TrustBadgesSection.jsx
import { 
  TrophyIcon, 
  StarIcon, 
  ShieldCheckIcon, 
  GlobeAltIcon, 
  UsersIcon 
} from '@heroicons/react/24/solid';
import '../../styles/TrustBadgesSection.css';

const TrustBadgesSection = () => {
  const badges = [
    {
      icon: TrophyIcon,
      title: 'Top 10 Global',
      description: 'Forbes 2024',
      highlight: true,
    },
    {
      icon: StarIcon,
      title: '4.8/5',
      description: '+15,000 reviews',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Fondos Seguros',
      description: 'Hasta $250,000',
    },
    {
      icon: GlobeAltIcon,
      title: '120+ Países',
      description: 'Disponible globalmente',
    },
    {
      icon: UsersIcon,
      title: '+500K Usuarios',
      description: 'Activos diariamente',
    },
  ];

  return (
    <section className="trust-section">
      <div className="trust-container">
        <div className="trust-grid">
          {badges.map((badge, index) => (
            <div 
              key={index} 
              className={`trust-badge ${badge.highlight ? 'trust-badge-highlight' : ''}`}
            >
              <div className="trust-badge-icon">
                <badge.icon className="trust-icon-size" />
              </div>
              <div className="trust-badge-content">
                <h4 className="trust-badge-title">{badge.title}</h4>
                <p className="trust-badge-description">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadgesSection;