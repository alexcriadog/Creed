/**
 * useAppFonts — carga de fuentes del design system v3 (dark atlético)
 *
 * - **Body / UI** = Inter (400/500/600/700) — @expo-google-fonts/inter.
 * - **Display** = Space Grotesk (500/700) — @expo-google-fonts/space-grotesk.
 *   Geométrico y técnico; titulares, eyebrows y números hero (peso, cronómetro,
 *   "X/Y series"). Ver theme.ts → `fonts` para el mapeo display/body.
 *
 * Ambas familias se embeben en el bundle (carga sin red en producción).
 * Los nombres de familia registrados aquí deben coincidir con `fontFamily`/`fonts`
 * en packages/ui-native/src/theme.ts.
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
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

export type FontLoadResult = {
  fontsLoaded: boolean;
  fontError: Error | null;
};

/**
 * Carga las fuentes del design system v3: Inter (body) + Space Grotesk (display).
 * Retorna { fontsLoaded, fontError } para que _layout.tsx decida
 * si mostrar el splash o renderizar la app.
 */
export function useAppFonts(): FontLoadResult {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  return { fontsLoaded, fontError };
}
