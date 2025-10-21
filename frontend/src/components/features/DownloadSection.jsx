// src/components/features/DownloadSection.jsx
import QRCode from 'react-qr-code';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import mockupApp from '../../assets/images/mockup-app.png';
import '../../styles/DownloadSection.css';

const DownloadSection = () => {
  // URL placeholder para el QR
  const downloadURL = 'https://bitflow-exchange.com/download';

  return (
    <section className="download-section">
      <div className="download-container">
        {/* Imagen del mockup a la izquierda */}
        <div className="download-mockup">
          <img
            src={mockupApp}
            alt="Bitflow Mobile App"
            className="download-mockup-image"
          />
        </div>

        {/* Contenido a la derecha */}
        <div className="download-content">
          <h2 className="download-title">
            Opera desde cualquier lugar.
          </h2>
          <h3 className="download-subtitle">
            Tu exchange favorito en tu bolsillo.
          </h3>

          {/* QR Code */}
          <div className="download-qr-container">
            <div className="download-qr-wrapper">
              <QRCode
                value={downloadURL}
                size={140}
                level="H"
                className="download-qr-code"
              />
            </div>
            <p className="download-qr-text">
              Escanea para descargar la app
            </p>
            <p className="download-qr-platforms">
              Disponible para iOS y Android
            </p>
          </div>

          {/* Íconos de plataformas (NO clickeables) */}
          <div className="download-platforms">
            <div className="download-platform-item">
              <div className="download-platform-icon">
                <svg
                  className="download-icon-size"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </div>
              <div className="download-platform-info">
                <span className="download-platform-name">iOS</span>
              </div>
            </div>

            <div className="download-platform-item">
              <div className="download-platform-icon">
                <svg
                  className="download-icon-size"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.523 15.341c-.54-.537-1.005-1.006-1.005-1.972 0-.967.465-1.435 1.005-1.973.54-.537 1.078-1.074 1.078-2.483 0-1.411-.77-2.667-1.914-3.391l.643-1.018-1.018-.643-.643 1.018c-.773-.308-1.598-.463-2.423-.463-1.41 0-2.667.77-3.391 1.914L9.838 4.28 9.195 5.299l1.018.643c-.308.773-.463 1.598-.463 2.423 0 1.41.77 2.667 1.914 3.391l-.643 1.018 1.018.643.643-1.018c.773.308 1.598.463 2.423.463 1.409 0 2.666-.77 3.391-1.914l1.018 1.018.643-1.018-1.018-.643c.308-.773.463-1.598.463-2.423 0-1.409-.538-1.946-1.078-2.483-.54-.537-1.005-1.006-1.005-1.972s.465-1.435 1.005-1.973c.54-.537 1.078-1.074 1.078-2.483 0-1.41-.77-2.667-1.914-3.391l.643-1.018-1.018-.643-.643 1.018C13.924.155 13.099 0 12.274 0c-1.41 0-2.667.77-3.391 1.914L7.865.896l-.643 1.018 1.018.643c-.308.773-.463 1.598-.463 2.423 0 1.409.538 1.946 1.078 2.483.54.537 1.005 1.006 1.005 1.972s-.465 1.435-1.005 1.973c-.54.537-1.078 1.074-1.078 2.483 0 1.41.77 2.667 1.914 3.391l-.643 1.018 1.018.643.643-1.018c.773.308 1.598.463 2.423.463 1.41 0 2.667-.77 3.391-1.914l1.018 1.018.643-1.018-1.018-.643c.308-.773.463-1.598.463-2.423 0-1.409-.538-1.946-1.078-2.483zM12.274 18.274c-3.313 0-6-2.687-6-6s2.687-6 6-6 6 2.687 6 6-2.687 6-6 6z" />
                </svg>
              </div>
              <div className="download-platform-info">
                <span className="download-platform-name">Android</span>
              </div>
            </div>
          </div>

          {/* Mensaje de desarrollo */}
          <p className="download-dev-notice">
            <DevicePhoneMobileIcon className="download-dev-icon" />
            Aplicación en desarrollo - Próximamente disponible
          </p>
        </div>
      </div>
    </section>
  );
};

export default DownloadSection;