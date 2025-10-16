// src/components/features/FAQSection.jsx
import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const FAQSection = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqData = [
    {
      question: '¿Qué es un exchange de criptomonedas?',
      answer:
        'Un exchange de criptomonedas es una plataforma digital que permite comprar, vender e intercambiar criptomonedas. Funciona como intermediario entre compradores y vendedores, ofreciendo un entorno seguro para realizar transacciones con activos digitales como Bitcoin, Ethereum y otras criptomonedas.',
    },
    {
      question: '¿Cómo comprar Bitcoin en nuestro exchange?',
      answer:
        'Para comprar Bitcoin, primero debes crear una cuenta y verificar tu identidad. Luego, deposita fondos mediante transferencia bancaria o tarjeta. Una vez que tengas saldo disponible, dirígete a la sección de Mercados o Swap, selecciona Bitcoin (BTC), ingresa la cantidad que deseas comprar y confirma la transacción.',
    },
    {
      question: '¿Es seguro operar en este exchange?',
      answer:
        'Sí, implementamos múltiples capas de seguridad: autenticación de dos factores (2FA), encriptación de datos, almacenamiento en frío para la mayoría de fondos, y auditorías de seguridad regulares. Además, cumplimos con regulaciones financieras internacionales para proteger tus activos.',
    },
    {
      question: '¿Qué comisiones cobra el exchange?',
      answer:
        'Nuestras comisiones son competitivas y transparentes. Cobramos una comisión por transacción que varía entre 0.1% y 0.5% dependiendo del volumen de trading mensual. Los depósitos suelen ser gratuitos, mientras que los retiros tienen una tarifa mínima de red. Consulta nuestra página de tarifas para más detalles.',
    },
    {
      question: '¿Cómo verifico mi cuenta?',
      answer:
        'La verificación de cuenta es un proceso simple: 1) Proporciona tu información personal básica, 2) Sube una foto de tu documento de identidad vigente, 3) Realiza una selfie para verificación facial. El proceso usualmente toma entre 24-48 horas hábiles.',
    },
    {
      question: '¿Cuánto tiempo tarda un retiro?',
      answer:
        'Los retiros de criptomonedas generalmente se procesan en 15-30 minutos después de la confirmación. Los retiros en moneda fiat (dinero tradicional) pueden tardar de 1 a 5 días hábiles dependiendo del método bancario. Todos los retiros pasan por verificaciones de seguridad para proteger tus fondos.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer:
        'Aceptamos múltiples métodos de pago: transferencias bancarias, tarjetas de crédito/débito, y depósitos en criptomonedas desde otras wallets. También ofrecemos opciones de pago locales en diferentes países para facilitar el acceso a nuestros servicios.',
    },
    {
      question: '¿Puedo operar desde mi país?',
      answer:
        'Operamos en la mayoría de países de Latinoamérica y el mundo. Sin embargo, por regulaciones locales, algunos países pueden tener restricciones. Puedes verificar si tu país está disponible durante el proceso de registro o contactando a nuestro equipo de soporte.',
    },
  ];

  return (
    <section className="faq-section">
      <h2 className="section-title">Preguntas Frecuentes</h2>
      <div className="faq-container">
        {faqData.map((faq, index) => (
          <div key={index} className="faq-item">
            <button
              className={`faq-question ${openFaqIndex === index ? 'active' : ''}`}
              onClick={() => toggleFaq(index)}
            >
              <span>{faq.question}</span>
              <ChevronDownIcon className={`faq-icon ${openFaqIndex === index ? 'rotated' : ''}`} />
            </button>
            <div className={`faq-answer ${openFaqIndex === index ? 'open' : ''}`}>
              <p>{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQSection;