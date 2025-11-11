import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Componente Screen - Wrapper para todas las pantallas
 * Aplica SafeArea y tema automáticamente
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Contenido de la pantalla
 * @param {Array<'top'|'bottom'|'left'|'right'>} props.edges - Edges del SafeArea (default: ['top', 'bottom'])
 * @param {Object} props.style - Estilos adicionales
 */
export default function Screen({ children, edges = ['top', 'bottom'], style }) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.background },
        style,
      ]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});