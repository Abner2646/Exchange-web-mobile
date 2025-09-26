// src/components/ThemeSwitcher.jsx
import { useTheme } from '../hooks/useTheme';

const ThemeSwitcher = () => {
  const { themeMode, setThemeMode } = useTheme();

  const themes = [
    { mode: 'light', icon: '☀️', label: 'Claro' },
    { mode: 'dark', icon: '🌙', label: 'Oscuro' },
    { mode: 'crypto', icon: '₿', label: 'Crypto' },
  ];

  const currentTheme = themes.find(theme => theme.mode === themeMode);

  return (
    <div style={{
      position: 'relative',
      display: 'inline-block'
    }}>
      {/* Current Theme Button */}
      <button
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: 'var(--spacing-sm)',
          borderRadius: 'var(--radius-md)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          fontSize: '1.1rem',
          minWidth: '40px',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'var(--interactive-hover)';
          e.target.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'none';
          e.target.style.color = 'var(--text-secondary)';
        }}
        onClick={() => {
          // Cycle through themes
          const currentIndex = themes.findIndex(t => t.mode === themeMode);
          const nextIndex = (currentIndex + 1) % themes.length;
          setThemeMode(themes[nextIndex].mode);
        }}
        title={`Tema actual: ${currentTheme?.label || 'Claro'}`}
      >
        {currentTheme?.icon || '☀️'}
      </button>
    </div>
  );
};

export default ThemeSwitcher;