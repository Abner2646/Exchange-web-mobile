// src/components/features/FAQSection.jsx
import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: '¿Cómo empiezo a operar?',
      answer:
        'Regístrate con tu email, verifica tu identidad, deposita fondos y comienza a operar. Todo el proceso toma menos de 10 minutos.',
    },
    {
      question: '¿Qué comisiones cobran?',
      answer:
        'Nuestras comisiones son ultra competitivas: 0.1% por transacción en trading spot y 0% en depósitos. Sin costos ocultos.',
    },
    {
      question: '¿Es seguro depositar mis fondos?',
      answer:
        'Absolutamente. Utilizamos cold storage para el 95% de los fondos, autenticación de dos factores y las mejores prácticas de seguridad de la industria.',
    },
    {
      question: '¿Cuánto tiempo tardan los retiros?',
      answer:
        'Los retiros de criptomonedas se procesan en menos de 30 minutos. Los retiros bancarios pueden tardar de 1 a 3 días hábiles según tu banco.',
    },
    {
      question: '¿Ofrecen soporte al cliente?',
      answer:
        'Sí, nuestro equipo de soporte está disponible 24/7 en español a través de chat en vivo y email para resolver cualquier consulta.',
    },
    {
      question: '¿Puedo operar desde mi móvil?',
      answer:
        'Sí, nuestra aplicación móvil está disponible para iOS y Android. Descárgala desde las tiendas oficiales y opera desde cualquier lugar.',
    },
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-section">
      <h2 className="section-title">Preguntas Frecuentes</h2>
      <div className="faq-container">
        {faqs.map((faq, index) => (
          <div key={index} className="faq-item">
            <button
              className={`faq-question ${openIndex === index ? 'active' : ''}`}
              onClick={() => toggleFAQ(index)}
            >
              {faq.question}
              <ChevronDownIcon
                className={`faq-icon ${openIndex === index ? 'rotated' : ''}`}
              />
            </button>
            <div className={`faq-answer ${openIndex === index ? 'open' : ''}`}>
              <p>{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQSection;