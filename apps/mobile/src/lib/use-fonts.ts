/**
 * useAppFonts — carga de fuentes Inter para el design system v2
 *
 * Decisión de fuente (documentada en task-1-report.md):
 *   docs/design.md especifica Geist (Vercel). Sin embargo, @expo-google-fonts
 *   no dispone de Geist y el paquete oficial de Vercel no ofrece integración
 *   expo-font lista para usar. Inter es la primera alternativa declarada en el
 *   font-stack de design.md y está disponible como @expo-google-fonts/inter,
 *   lo que garantiza carga sin red en producción (archivos embebidos en el bundle).
 *   Migrar a Geist cuando exista soporte oficial de expo-google-fonts o cuando
 *   se integre directamente via expo-font con assets locales.
 *
 * Uso:
 *   const { fontsLoaded, fontError } = useAppFonts();
 *   if (!fontsLoaded && !fontError) return null; // mantener splash
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

export type FontLoadResult = {
  fontsLoaded: boolean;
  fontError: Error | null;
};

/**
 * Carga los 4 pesos de Inter necesarios para el design system.
 * Retorna { fontsLoaded, fontError } para que _layout.tsx decida
 * si mostrar el splash o renderizar la app.
 */
export function useAppFonts(): FontLoadResult {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return { fontsLoaded, fontError };
}
