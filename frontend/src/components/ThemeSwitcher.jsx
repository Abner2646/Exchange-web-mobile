// src/components/ThemeSwitcher.jsx
import { useTheme } from '../hooks/useTheme';
import { SunIcon, MoonIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const ThemeSwitcher = () => {
  const { themeMode, setThemeMode } = useTheme();

  const themes = [
    { mode: 'light', icon: SunIcon, label: 'Claro' },
    { mode: 'dark', icon: MoonIcon, label: 'Oscuro' },
    { mode: 'bitflow', icon: CurrencyDollarIcon, label: 'BitFlow' },
  ];

  const currentTheme = themes.find(theme => theme.mode === themeMode);
  const CurrentIcon = currentTheme?.icon || SunIcon;

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
        <CurrentIcon style={{ width: '1.2em', height: '1.2em' }} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;