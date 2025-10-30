import { Slot } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </ThemeProvider>
  );
}