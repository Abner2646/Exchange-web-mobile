// services/emailService.js
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

  // Enviar código de recuperación de contraseña
  async enviarCodigoRecuperacion(email, codigo, username) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Crypto Exchange'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de recuperación de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Has solicitado recuperar tu contraseña. Usa el siguiente código para continuar:</p>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; letter-spacing: 5px; margin: 0;">${codigo}</h1>
          </div>
          
          <p><strong>Este código expira en 15 minutos.</strong></p>
          
          <p>Si no solicitaste este código, ignora este email. Tu cuenta permanece segura.</p>
          
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            ${process.env.APP_NAME || 'Crypto Exchange'} - No responder a este email
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Código de recuperación enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('Error enviando código de recuperación:', error);
      throw new Error('Error al enviar email de recuperación');
    }
  }

  // Enviar código de autenticación de dos factores
  async enviarCodigo2FA(email, codigo, username) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Crypto Exchange'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de verificación en dos pasos',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verificación en Dos Pasos</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Alguien está intentando acceder a tu cuenta. Si eres tú, usa el siguiente código:</p>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #28a745; letter-spacing: 5px; margin: 0;">${codigo}</h1>
          </div>
          
          <p><strong>Este código expira en 5 minutos.</strong></p>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0;">
            <strong>⚠️ Importante:</strong> Si no fuiste tú, cambia tu contraseña inmediatamente.
          </div>
          
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            ${process.env.APP_NAME || 'Crypto Exchange'} - No responder a este email
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Código 2FA enviado a ${email}`);
      return result;
    } catch (error) {
      console.error('Error enviando código 2FA:', error);
      throw new Error('Error al enviar código de verificación');
    }
  }

  // Notificar activación/desactivación de 2FA
  async notificar2FAChange(email, username, activado) {
    const action = activado ? 'activado' : 'desactivado';
    const color = activado ? '#28a745' : '#dc3545';
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Crypto Exchange'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Autenticación en dos pasos ${action}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${color};">Autenticación en Dos Pasos ${activado ? 'Activada' : 'Desactivada'}</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>La autenticación en dos pasos ha sido <strong>${action}</strong> en tu cuenta.</p>
          
          ${activado ? 
            `<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <strong>✅ Tu cuenta es ahora más segura.</strong><br>
              A partir de ahora necesitarás verificar tu identidad con un código por email al iniciar sesión.
            </div>` :
            `<div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
              <strong>⚠️ Seguridad reducida.</strong><br>
              Tu cuenta ya no requiere verificación en dos pasos para el login.
            </div>`
          }
          
          <p>Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
          
          <p>Si no realizaste este cambio, contacta inmediatamente a soporte.</p>
          
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            ${process.env.APP_NAME || 'Crypto Exchange'} - No responder a este email
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Notificación 2FA (${action}) enviada a ${email}`);
      return result;
    } catch (error) {
      console.error('Error enviando notificación 2FA:', error);
      throw new Error('Error al enviar notificación');
    }
  }

  // Notificar cambio de contraseña exitoso
  async notificarCambioPassword(email, username) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Crypto Exchange'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Contraseña actualizada exitosamente',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Contraseña Actualizada</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Tu contraseña ha sido cambiada exitosamente.</p>
          
          <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
            <strong>✅ Cambio confirmado</strong><br>
            Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <strong>⚠️ ¿No fuiste tú?</strong><br>
            Si no cambiaste tu contraseña, contacta inmediatamente a nuestro equipo de soporte.
          </div>
          
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            ${process.env.APP_NAME || 'Crypto Exchange'} - No responder a este email
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Notificación cambio de contraseña enviada a ${email}`);
      return result;
    } catch (error) {
      console.error('Error enviando notificación de cambio de contraseña:', error);
      // No lanzar error aquí porque el cambio de contraseña ya fue exitoso
      return null;
    }
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;