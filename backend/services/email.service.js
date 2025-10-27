// services/email.service.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Colores basados en tema claro de BitFlow
    this.colors = {
      brand: {
        primary: '#007bff',
        secondary: '#0056b3',
        tertiary: '#e6f2ff'
      },
      semantic: {
        success: '#28a745',
        successBg: '#d4edda',
        error: '#dc3545',
        errorBg: '#f8d7da',
        warning: '#ffc107',
        warningBg: '#fff3cd',
        info: '#17a2b8',
        infoBg: '#d1ecf1'
      },
      trading: {
        buy: '#28a745',
        buyHover: '#218838',
        buyBg: '#d4edda',
        sell: '#dc3545',
        sellHover: '#c82333',
        sellBg: '#f8d7da'
      },
      text: {
        primary: '#212529',
        secondary: '#6c757d',
        tertiary: '#adb5bd',
        inverse: '#ffffff'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f8f9fa',
        elevated: '#ffffff'
      },
      border: {
        subtle: '#dee2e6',
        primary: '#adb5bd',
        focus: '#007bff',
        focusRing: 'rgba(0, 123, 255, 0.25)'
      }
    };

    this.spacing = {
      xs: '6px',
      sm: '12px',
      md: '24px',
      lg: '36px',
      xl: '48px',
      xxl: '72px'
    };

    this.radius = {
      sm: '6px',
      md: '12px',
      lg: '18px',
      full: '9999px'
    };
  }

  // Verificar conexión del transportador
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service conectado correctamente');
      return true;
    } catch (error) {
      console.error('Error en email service:', error);
      return false;
    }
  }

  // Template base para todos los emails
  getBaseTemplate(content, title) {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - BitFlow</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', Arial, sans-serif;
            background: ${this.colors.background.secondary};
            color: ${this.colors.text.primary};
            line-height: 1.6;
            padding: ${this.spacing.lg};
          }
          
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: ${this.colors.background.primary};
            border-radius: ${this.radius.lg};
            border: 1px solid ${this.colors.border.subtle};
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          .email-header {
            background: linear-gradient(135deg, ${this.colors.brand.primary} 0%, ${this.colors.brand.secondary} 100%);
            padding: ${this.spacing.xl};
            text-align: center;
            color: ${this.colors.text.inverse};
          }
          
          .email-logo {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: ${this.spacing.sm};
          }
          
          .email-title {
            font-size: 1.5rem;
            font-weight: 600;
            opacity: 0.9;
          }
          
          .email-content {
            padding: ${this.spacing.xl};
          }
          
          .content-title {
            font-size: 1.75rem;
            font-weight: 600;
            color: ${this.colors.text.primary};
            margin-bottom: ${this.spacing.md};
            line-height: 1.2;
          }
          
          .content-text {
            color: ${this.colors.text.secondary};
            margin-bottom: ${this.spacing.lg};
            font-size: 1rem;
            line-height: 1.6;
          }
          
          .code-container {
            background: ${this.colors.background.secondary};
            padding: ${this.spacing.lg};
            border-radius: ${this.radius.md};
            border: 1px solid ${this.colors.border.subtle};
            text-align: center;
            margin: ${this.spacing.lg} 0;
            transition: all 0.2s ease;
          }
          
          .code-container:hover {
            border-color: ${this.colors.brand.primary};
            box-shadow: 0 0 0 3px ${this.colors.border.focusRing};
          }
          
          .verification-code {
            font-size: 2.5rem;
            font-weight: 700;
            color: ${this.colors.brand.primary};
            letter-spacing: 8px;
            margin: ${this.spacing.md} 0;
            font-family: 'Courier New', monospace;
          }
          
          .code-hint {
            font-size: 0.875rem;
            color: ${this.colors.text.tertiary};
            margin-top: ${this.spacing.sm};
          }
          
          .alert {
            padding: ${this.spacing.lg};
            border-radius: ${this.radius.md};
            margin: ${this.spacing.lg} 0;
            border-left: 4px solid transparent;
          }
          
          .alert-success {
            background: ${this.colors.semantic.successBg};
            border-color: ${this.colors.semantic.success};
            color: ${this.colors.semantic.success};
          }
          
          .alert-warning {
            background: ${this.colors.semantic.warningBg};
            border-color: ${this.colors.semantic.warning};
            color: #856404;
          }
          
          .alert-error {
            background: ${this.colors.semantic.errorBg};
            border-color: ${this.colors.semantic.error};
            color: ${this.colors.semantic.error};
          }
          
          .alert-info {
            background: ${this.colors.semantic.infoBg};
            border-color: ${this.colors.semantic.info};
            color: ${this.colors.semantic.info};
          }
          
          .transaction-details {
            background: ${this.colors.background.secondary};
            padding: ${this.spacing.lg};
            border-radius: ${this.radius.md};
            margin: ${this.spacing.lg} 0;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: ${this.spacing.sm} 0;
            border-bottom: 1px solid ${this.colors.border.subtle};
          }
          
          .detail-row:last-child {
            border-bottom: none;
          }
          
          .detail-label {
            color: ${this.colors.text.secondary};
            font-weight: 500;
          }
          
          .detail-value {
            color: ${this.colors.text.primary};
            font-weight: 600;
          }
          
          .email-footer {
            padding: ${this.spacing.lg};
            text-align: center;
            background: ${this.colors.background.secondary};
            color: ${this.colors.text.tertiary};
            font-size: 0.875rem;
            border-top: 1px solid ${this.colors.border.subtle};
          }
          
          @media (max-width: 600px) {
            body {
              padding: ${this.spacing.sm};
            }
            
            .email-content {
              padding: ${this.spacing.lg};
            }
            
            .verification-code {
              font-size: 2rem;
              letter-spacing: 4px;
            }
            
            .content-title {
              font-size: 1.5rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <div class="email-logo">BitFlow</div>
            <div class="email-title">${title}</div>
          </div>
          
          <div class="email-content">
            ${content}
          </div>
          
          <div class="email-footer">
            BitFlow Exchange - No responder a este email
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Enviar código de recuperación de contraseña
  async enviarCodigoRecuperacion(email, codigo, username) {
    const content = `
      <h2 class="content-title">Recuperación de Contraseña</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">Has solicitado recuperar tu contraseña. Usa el siguiente código para continuar con el proceso:</p>
      
      <div class="code-container">
        <div class="verification-code">${codigo}</div>
        <div class="code-hint">Haz clic y copia el código • Expira en 15 minutos</div>
      </div>
      
      <div class="alert alert-warning">
        <strong>⚠️ Seguridad:</strong> Si no solicitaste este código, ignora este email. Tu cuenta permanece segura.
      </div>
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de recuperación de contraseña - BitFlow',
      html: this.getBaseTemplate(content, 'Recuperación de Contraseña')
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Código de recuperación enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando código de recuperación:', error);
      throw new Error('Error al enviar email de recuperación');
    }
  }

  // Enviar código de verificación de email
  async enviarCodigoVerificacionEmail(email, codigo, username) {
    const content = `
      <h2 class="content-title">¡Bienvenido a BitFlow!</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">Gracias por registrarte en BitFlow. Para activar tu cuenta y comenzar a operar, verifica tu email usando el siguiente código:</p>
      
      <div class="code-container">
        <div class="verification-code">${codigo}</div>
        <div class="code-hint">Haz clic y copia el código • Expira en 1 hora</div>
      </div>
      
      <div class="alert alert-info">
        <strong>💡 Importante:</strong> La verificación de email es requerida para acceder a todas las funciones de la plataforma.
      </div>
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verifica tu email - BitFlow',
      html: this.getBaseTemplate(content, 'Verificación de Email')
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Código de verificación de email enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando código de verificación de email:', error);
      throw new Error('Error al enviar email de verificación');
    }
  }

  // Enviar código de autenticación de dos factores
  async enviarCodigo2FA(email, codigo, username) {
    const content = `
      <h2 class="content-title">Verificación en Dos Pasos</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">Se ha detectado un intento de acceso a tu cuenta. Para completar el inicio de sesión, usa el siguiente código de verificación:</p>
      
      <div class="code-container">
        <div class="verification-code">${codigo}</div>
        <div class="code-hint">Haz clic y copia el código • Expira en 5 minutos</div>
      </div>
      
      <div class="alert alert-warning">
        <strong>🔒 Alerta de seguridad:</strong> Si no reconoces este intento de acceso, cambia tu contraseña inmediatamente y contacta con soporte.
      </div>
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de verificación en dos pasos - BitFlow',
      html: this.getBaseTemplate(content, 'Verificación en Dos Pasos')
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Código 2FA enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando código 2FA:', error);
      throw new Error('Error al enviar código de verificación');
    }
  }

  // Notificar activación/desactivación de 2FA
  async notificar2FAChange(email, username, activado) {
    const action = activado ? 'activado' : 'desactivado';
    const alertType = activado ? 'alert-success' : 'alert-error';
    const alertIcon = activado ? '✅' : '⚠️';
    
    const content = `
      <h2 class="content-title">Autenticación en Dos Pasos ${activado ? 'Activada' : 'Desactivada'}</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">La autenticación en dos pasos ha sido <strong>${action}</strong> en tu cuenta de BitFlow.</p>
      
      <div class="alert ${alertType}">
        <strong>${alertIcon} ${activado ? 'Seguridad mejorada' : 'Seguridad reducida'}:</strong>
        ${activado 
          ? 'A partir de ahora necesitarás verificar tu identidad con un código por email al iniciar sesión.'
          : 'Tu cuenta ya no requiere verificación en dos pasos para el login.'
        }
      </div>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Acción:</span>
          <span class="detail-value">Autenticación 2FA ${action}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha:</span>
          <span class="detail-value">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Usuario:</span>
          <span class="detail-value">${username}</span>
        </div>
      </div>
      
      ${!activado ? `
        <div class="alert alert-warning">
          <strong>💡 Recomendación:</strong> Para mayor seguridad, te recomendamos mantener la autenticación en dos pasos activada.
        </div>
      ` : ''}
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Autenticación en dos pasos ${action} - BitFlow`,
      html: this.getBaseTemplate(content, `2FA ${activado ? 'Activado' : 'Desactivado'}`)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Notificación 2FA (${action}) enviada a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando notificación 2FA:', error);
      throw new Error('Error al enviar notificación');
    }
  }

  // Notificar cambio de contraseña exitoso
  async notificarCambioPassword(email, username) {
    const content = `
      <h2 class="content-title">Contraseña Actualizada</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">Tu contraseña ha sido cambiada exitosamente en BitFlow.</p>
      
      <div class="alert alert-success">
        <strong>✅ Cambio confirmado:</strong> Tu contraseña fue actualizada correctamente.
      </div>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Acción:</span>
          <span class="detail-value">Cambio de contraseña</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha:</span>
          <span class="detail-value">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Usuario:</span>
          <span class="detail-value">${username}</span>
        </div>
      </div>
      
      <div class="alert alert-warning">
        <strong>🔐 ¿No fuiste tú?</strong> Si no realizaste este cambio, contacta inmediatamente con nuestro equipo de soporte.
      </div>
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Contraseña actualizada exitosamente - BitFlow',
      html: this.getBaseTemplate(content, 'Contraseña Actualizada')
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Notificación cambio de contraseña enviada a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando notificación de cambio de contraseña:', error);
      return null;
    }
  }

  // Enviar código de verificación para transferencia
  async enviarCodigoTransferencia(email, codigo, username, cantidad, simbolo, destinatario) {
    const content = `
      <h2 class="content-title">Verificación de Transferencia</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">Estás intentando transferir <strong>${cantidad} ${simbolo}</strong> a <strong>${destinatario}</strong>.</p>
      <p class="content-text">Para confirmar esta transacción, usa el siguiente código de verificación:</p>
      
      <div class="code-container">
        <div class="verification-code">${codigo}</div>
        <div class="code-hint">Haz clic y copia el código • Expira en 10 minutos</div>
      </div>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Destinatario:</span>
          <span class="detail-value">${destinatario}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Cantidad:</span>
          <span class="detail-value">${cantidad} ${simbolo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tipo:</span>
          <span class="detail-value">Transferencia</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha solicitud:</span>
          <span class="detail-value">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
        </div>
      </div>
      
      <div class="alert alert-warning">
        <strong>⚠️ Importante:</strong> Si no realizaste esta transferencia, cancela el proceso inmediatamente.
      </div>
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Código de verificación para transferencia de ${cantidad} ${simbolo} - BitFlow`,
      html: this.getBaseTemplate(content, 'Verificación de Transferencia')
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Código de verificación de transferencia enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Error enviando código de verificación de transferencia:', error);
      throw new Error('Error al enviar email de verificación de transferencia');
    }
  }

  // Notificar transferencia completada
  async notificarTransferenciaCompletada(email, username, cantidad, simbolo, otroUsuario, tipo) {
    const isEnviada = tipo === 'enviada';
    const title = isEnviada ? 'Transferencia Completada' : 'Fondos Recibidos';
    const subject = isEnviada 
      ? `Transferencia de ${cantidad} ${simbolo} completada - BitFlow`
      : `Has recibido ${cantidad} ${simbolo} - BitFlow`;

    const content = `
      <h2 class="content-title">${title}</h2>
      <p class="content-text">Hola <strong>${username}</strong>,</p>
      <p class="content-text">
        ${isEnviada 
          ? `Has transferido exitosamente <strong>${cantidad} ${simbolo}</strong> a <strong>${otroUsuario}</strong>.`
          : `Has recibido <strong>${cantidad} ${simbolo}</strong> de <strong>${otroUsuario}</strong>.`
        }
      </p>
      
      <div class="alert alert-success">
        <strong>✅ Transacción exitosa:</strong> La operación ha sido procesada y los fondos han sido transferidos.
      </div>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">${isEnviada ? 'Destinatario' : 'Remitente'}:</span>
          <span class="detail-value">${otroUsuario}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Cantidad:</span>
          <span class="detail-value">${cantidad} ${simbolo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tipo:</span>
          <span class="detail-value">${isEnviada ? 'Envío' : 'Recepción'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha:</span>
          <span class="detail-value">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Estado:</span>
          <span class="detail-value" style="color: ${this.colors.semantic.success};">Completado</span>
        </div>
      </div>
      
      ${isEnviada ? `
        <div class="alert alert-info">
          <strong>💡 Recordatorio:</strong> Las transferencias son irreversibles. Verifica siempre la dirección del destinatario.
        </div>
      ` : ''}
    `;

    const mailOptions = {
      from: `"BitFlow Exchange" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: this.getBaseTemplate(content, title)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Notificación de transferencia ${tipo} enviada a ${email}`);
      return result;
    } catch (error) {
      console.error(`❌ Error enviando notificación de transferencia ${tipo}:`, error);
      throw new Error(`Error al enviar notificación de transferencia ${tipo}`);
    }
  }

}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;