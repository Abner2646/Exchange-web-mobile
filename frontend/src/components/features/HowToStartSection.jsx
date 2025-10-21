// src/components/features/HowToStartSection.jsx
import { 
  UserPlusIcon, 
  ShieldCheckIcon, 
  CreditCardIcon, 
  ArrowsRightLeftIcon 
} from '@heroicons/react/24/outline';
import '../../styles/HowToStartSection.css';

const HowToStartSection = () => {
  const steps = [
    {
      icon: UserPlusIcon,
      title: 'Crea tu cuenta',
      description: 'Registro gratuito en menos de 2 minutos',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Verifica tu identidad',
      description: 'Proceso simple y seguro para proteger tu cuenta',
    },
    {
      icon: CreditCardIcon,
      title: 'Deposita fondos',
      description: 'Transferencia bancaria o depósito de criptomonedas',
    },
    {
      icon: ArrowsRightLeftIcon,
      title: 'Comienza a operar',
      description: 'Swap, P2P y todas nuestras herramientas a tu alcance',
    },
  ];

  return (
    <section className="howto-section">
      <h2 className="howto-title">Comienza en 4 simples pasos</h2>
      <p className="howto-subtitle">
        Tu camino hacia el trading de criptomonedas comienza aquí
      </p>

      <div className="howto-grid">
        {steps.map((step, index) => (
          <div key={index} className="howto-step">
            <div className="howto-step-number">{index + 1}</div>
            <div className="howto-step-icon">
              <step.icon className="howto-icon-size" />
            </div>
            <h3 className="howto-step-title">{step.title}</h3>
            <p className="howto-step-description">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="howto-connector">
        <div className="howto-connector-line"></div>
      </div>
    </section>
  );
};

export default HowToStartSection;