// src/components/features/EmptyPortfolioMessage.jsx
import { CurrencyDollarIcon, ArrowTrendingUpIcon, UsersIcon } from '@heroicons/react/24/outline';
import '../../styles/EmptyPortfolioMessage.css';

const EmptyPortfolioMessage = ({ onNavigate }) => {
  return (
    <div className="emptyportfolio-message">
      <div className="emptyportfolio-icon-wrapper">
        <CurrencyDollarIcon className="emptyportfolio-icon" />
      </div>
      
      <h3 className="emptyportfolio-title">¡Empieza tu viaje cripto!</h3>
      <p className="emptyportfolio-description">
        Tu portfolio está vacío. Deposita fondos o realiza tu primera compra para comenzar.
      </p>
      
      <div className="emptyportfolio-actions">
        <button 
          className="emptyportfolio-btn emptyportfolio-btn-primary"
          onClick={() => onNavigate?.('/depositos')}
        >
          Depositar Fondos
        </button>
        <button 
          className="emptyportfolio-btn emptyportfolio-btn-secondary"
          onClick={() => onNavigate?.('/swap')}
        >
          Comprar Cripto
        </button>
      </div>

      <div className="emptyportfolio-features">
        <div className="emptyportfolio-feature">
          <ArrowTrendingUpIcon className="emptyportfolio-feature-icon" />
          <span>Comisiones desde 0.1%</span>
        </div>
        <div className="emptyportfolio-feature">
          <CurrencyDollarIcon className="emptyportfolio-feature-icon" />
          <span>+200 criptomonedas</span>
        </div>
        <div className="emptyportfolio-feature">
          <UsersIcon className="emptyportfolio-feature-icon" />
          <span>+500K usuarios</span>
        </div>
      </div>
    </div>
  );
};

export default EmptyPortfolioMessage;