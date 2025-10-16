// src/utils/validators.js

// Validar formulario de registro
export const validateRegistrationForm = (formData) => {
  const errors = {};

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email) {
    errors.email = 'El email es requerido';
  } else if (!emailRegex.test(formData.email)) {
    errors.email = 'Ingresa un email válido';
  }

  // Username
  if (!formData.username) {
    errors.username = 'El usuario es requerido';
  } else if (formData.username.length < 3) {
    errors.username = 'El usuario debe tener al menos 3 caracteres';
  }

  // Password
  if (!formData.password) {
    errors.password = 'La contraseña es requerida';
  } else if (formData.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres';
  }

  // Confirm Password
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Debes confirmar la contraseña';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  // País
  if (!formData.pais) {
    errors.pais = 'El país es requerido';
  }

  return errors;
};

// Otras validaciones reutilizables...
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password && password.length >= 8;
};

// Alias para compatibilidad con código original
export const isValidEmail = validateEmail;

