# Fase 1 — Cimientos de la app nativa · Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Montar una app Expo (React Native) en el monorepo que arranca en el iPhone, con design system nativo (`ui-native`), auth real contra Supabase (OTP email) y navegación con auth-gate; lista para subir a TestFlight.

**Architecture:** Nueva `apps/mobile` (Expo Router) en el pnpm/Turbo monorepo, reutilizando el backend Supabase existente. Un paquete `packages/ui-native` con NativeWind v4 y los tokens de `docs/design.md` portados a valores que React Native sabe renderizar. La web actual (`apps/web`) sigue intacta durante esta fase.

**Tech Stack:** Expo SDK (última) + Expo Router · React Native · TypeScript · NativeWind v4 (Tailwind 3.4) · `@supabase/supabase-js` + `@react-native-async-storage/async-storage` · jest-expo + `@testing-library/react-native` · EAS Build.

## Global Constraints

- **pnpm** `>=9.0.0` (repo en `pnpm@9.12.0`). **Node** `>=20` (`.nvmrc`: `20`).
- **No romper `apps/web`**: tras cada tarea que toque config raíz, `pnpm --filter @creed/web typecheck` (o `build`) debe seguir pasando.
- **Supabase**: mismo proyecto que la web. Env vars en mobile con prefijo `EXPO_PUBLIC_`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mismos valores que `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). **Nunca** meter `SUPABASE_SECRET_KEY` en la app.
- **Auth**: email + OTP de 6 dígitos (`signInWithOtp` con `shouldCreateUser: true` → `verifyOtp` con `type: 'email'`). El trigger `on_auth_user_created` ya crea `profiles` + `athlete_folder`; tras verificar, mirar `profiles.onboarding_status` (`pending|in_progress|complete`).
- **Colores**: los tokens de `design.md` están en `oklch`, que **React Native no renderiza**. `ui-native` usa las conversiones hex/rgba de la Tarea 3 (a afinar en revisión visual; no inventar nuevos colores).
- **TDD donde aporta señal** (lógica de auth, gate de navegación, componentes con comportamiento). El andamiaje (scaffold Expo, metro, EAS) se valida con "ejecuta y observa", no con unit test.
- **Commits frecuentes**, formato `<type>: <desc>` (feat/chore/test/docs), sin trailer de atribución.

## Prerrequisitos (humano, antes de empezar)

- Tener instalado Xcode + simulador iOS (macOS). `xcode-select --install` si falta.
- **Tarea 7 (TestFlight) requiere cuenta Apple Developer (99 $/año).** Si aún no existe, las Tareas 1-6 se completan igual (build de desarrollo en simulador/dispositivo) y la Tarea 7 se hace cuando la cuenta esté lista. No bloquea el resto.

## Estructura de archivos (qué se crea)

```
.npmrc                                  ← node-linker=hoisted (compat Metro+pnpm)
apps/mobile/
  app/                                  ← Expo Router (file-based)
    _layout.tsx                         ← root layout: AuthProvider + global.css + Slot
    index.tsx                           ← redirección según sesión
    (auth)/
      _layout.tsx                       ← stack de auth
      login.tsx                         ← pedir email → sendOtp
      verify.tsx                        ← código 6 dígitos → verifyOtp
    (app)/
      _layout.tsx                       ← gate: sin sesión → /login; stack
      index.tsx                         ← pantalla "Hoy" (placeholder)
  lib/
    supabase.ts                         ← cliente RN (AsyncStorage)
    auth.ts                             ← sendOtp/verifyOtp/signOut + helpers
    auth-context.tsx                    ← AuthProvider + useAuth (sesión live)
  global.css                            ← @tailwind directives
  tailwind.config.js                    ← extiende preset de ui-native
  babel.config.js · metro.config.js · nativewind-env.d.ts
  app.json · eas.json
  package.json · tsconfig.json · jest.config.js · jest-setup.ts
  .env.local · .gitignore
packages/ui-native/
  package.json · tsconfig.json
  tailwind-preset.js                    ← tokens design.md (hex/rgba)
  src/
    index.ts
    Button.tsx · Surface.tsx · Screen.tsx · Text.tsx
    Button.test.tsx
```

---

### Task 1: Scaffold Expo + cableado del monorepo

**Files:**
- Create: `apps/mobile/` (vía `create-expo-app`), `apps/mobile/metro.config.js`, `.npmrc`
- Modify: `apps/mobile/package.json` (nombre + scripts turbo-compatibles)

**Interfaces:**
- Produces: una `apps/mobile` arrancable con `expo start`; nombre de paquete `@creed/mobile`.

- [ ] **Step 1: Crear la app Expo** (template TS con expo-router)

Run desde la raíz del repo:
```bash
pnpm dlx create-expo-app@latest apps/mobile --template default --no-install
```
Expected: crea `apps/mobile/` con `app/`, `package.json`, `app.json`, `tsconfig.json`. (`--no-install` porque instalamos con pnpm desde la raíz.)

- [ ] **Step 2: Renombrar el paquete y poner scripts turbo-compatibles**

Editar `apps/mobile/package.json` para que `name` y `scripts` queden así (conservar las `dependencies`/`devDependencies` que generó Expo):
```json
{
  "name": "@creed/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "ios": "expo start --ios",
    "lint": "echo \"lint skipped\"",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  }
}
```

- [ ] **Step 3: Añadir `.npmrc` para compatibilidad Metro + pnpm**

Crear `.npmrc` en la raíz del repo:
```
node-linker=hoisted
```
(Metro no sigue bien los symlinks de pnpm; `hoisted` aplana `node_modules` como npm/yarn. Es el patrón estándar para RN en monorepos pnpm.)

- [ ] **Step 4: Instalar desde la raíz**

Run:
```bash
pnpm install
```
Expected: instala sin errores; `apps/mobile/node_modules` poblado.

- [ ] **Step 5: Configurar Metro para el monorepo**

Crear `apps/mobile/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 6: Arrancar en el simulador iOS**

Run:
```bash
pnpm --filter @creed/mobile exec expo start --ios
```
Expected: Metro compila y abre la app por defecto de Expo en el simulador iOS sin errores de resolución de módulos.

- [ ] **Step 7: Verificar que la web sigue intacta**

Run:
```bash
pnpm --filter @creed/web typecheck
```
Expected: PASS (el `.npmrc` y la nueva app no rompen la web).

- [ ] **Step 8: Commit**

```bash
git add .npmrc apps/mobile pnpm-lock.yaml
git commit -m "chore(mobile): scaffold Expo app en el monorepo"
```

---

### Task 2: Harness de tests (jest-expo + RNTL)

**Files:**
- Create: `apps/mobile/jest.config.js`, `apps/mobile/jest-setup.ts`, `apps/mobile/app/__tests__/smoke.test.tsx`
- Modify: `apps/mobile/package.json` (devDeps)

**Interfaces:**
- Produces: `pnpm --filter @creed/mobile test` ejecuta tests RNTL.

- [ ] **Step 1: Instalar dependencias de test**

Run:
```bash
pnpm --filter @creed/mobile add -D jest jest-expo @testing-library/react-native @types/jest react-test-renderer
```

- [ ] **Step 2: Configurar jest**

Crear `apps/mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
};
```

Crear `apps/mobile/jest-setup.ts`:
```ts
import '@testing-library/react-native/extend-expect';
```

- [ ] **Step 3: Escribir un test de humo (debe pasar tras configurar)**

Crear `apps/mobile/app/__tests__/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

test('el harness de RNTL renderiza y consulta', () => {
  render(<Text>hola creed</Text>);
  expect(screen.getByText('hola creed')).toBeOnTheScreen();
});
```

- [ ] **Step 4: Ejecutar para verlo pasar**

Run:
```bash
pnpm --filter @creed/mobile test
```
Expected: PASS, 1 test. (Si falla por config de jest, ajustar `transformIgnorePatterns` antes de seguir.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/jest.config.js apps/mobile/jest-setup.ts apps/mobile/app/__tests__ apps/mobile/package.json pnpm-lock.yaml
git commit -m "test(mobile): harness jest-expo + RNTL"
```

---

### Task 3: `ui-native` — preset de tokens + NativeWind cableado

**Files:**
- Create: `packages/ui-native/package.json`, `packages/ui-native/tsconfig.json`, `packages/ui-native/tailwind-preset.js`, `packages/ui-native/src/index.ts`
- Create: `apps/mobile/tailwind.config.js`, `apps/mobile/global.css`, `apps/mobile/babel.config.js`, `apps/mobile/nativewind-env.d.ts`
- Modify: `apps/mobile/metro.config.js`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`

**Interfaces:**
- Produces: preset `@creed/ui-native/tailwind-preset` con tokens semánticos (`canvas`, `surface`, `accent`, `text-primary`, …); clases NativeWind funcionando en la app.

- [ ] **Step 1: Crear el paquete `ui-native`**

Crear `packages/ui-native/package.json`:
```json
{
  "name": "@creed/ui-native",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind-preset": "./tailwind-preset.js"
  },
  "scripts": {
    "lint": "echo \"lint skipped\"",
    "typecheck": "tsc --noEmit",
    "test": "echo \"tests run in apps/mobile\""
  },
  "peerDependencies": {
    "nativewind": "*",
    "react": "*",
    "react-native": "*"
  }
}
```

Crear `packages/ui-native/tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tailwind-preset.js"]
}
```

- [ ] **Step 2: Definir el preset de tokens** (conversiones hex/rgba de `design.md`)

Crear `packages/ui-native/tailwind-preset.js`:
```js
/**
 * Tokens de docs/design.md portados a valores renderizables por React Native.
 * Los oklch originales no son renderizables en RN; estos hex/rgba son conversiones
 * aproximadas — afinar en revisión visual, no inventar nuevos.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#F6F7FA', tint: '#EDEFF4' },
        surface: { DEFAULT: '#FFFFFF', strong: '#FFFFFF' },
        border: { subtle: '#E7E9EE', DEFAULT: '#E3E5EA', strong: '#CDD0D8' },
        text: { primary: '#1F2024', secondary: '#54565C', muted: '#8A8C93', 'on-accent': '#FCFCFD' },
        accent: { DEFAULT: '#4F62E0', strong: '#3D4FCC', soft: 'rgba(79,98,224,0.12)' },
        status: { green: '#34B36B', amber: '#E2A23A', red: '#DE4A3C' },
        // Dark (usar con variante dark:)
        'canvas-dark': { DEFAULT: '#16171B', tint: '#1D1F25' },
        'surface-dark': { DEFAULT: '#23252C' },
        'text-dark': { primary: '#F4F5F7', secondary: '#B3B5BC', muted: '#83858C' },
        'accent-dark': { DEFAULT: '#7C8CFF' },
      },
      borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, pill: 9999 },
      fontFamily: { sans: ['Geist', 'System'], display: ['Geist', 'System'], mono: ['Geist Mono', 'monospace'] },
    },
  },
};
```

- [ ] **Step 3: Instalar NativeWind y dependencias en la app**

Run:
```bash
pnpm --filter @creed/mobile add nativewind react-native-reanimated react-native-safe-area-context @creed/ui-native
pnpm --filter @creed/mobile add -D tailwindcss@3.4.17
```

- [ ] **Step 4: Configurar Tailwind, babel, css y tipos en la app**

Crear `apps/mobile/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}',
  ],
  presets: [
    require('nativewind/preset'),
    require('@creed/ui-native/tailwind-preset'),
  ],
  theme: { extend: {} },
  plugins: [],
};
```

Crear `apps/mobile/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Crear `apps/mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

Crear `apps/mobile/nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 5: Conectar NativeWind en Metro**

Editar `apps/mobile/metro.config.js` para envolver con NativeWind (mantener el monorepo config de la Tarea 1):
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 6: Importar `global.css` en el root layout**

Reemplazar `apps/mobile/app/_layout.tsx` por:
```tsx
import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Verificar que NativeWind aplica un token**

Editar `apps/mobile/app/index.tsx` temporalmente:
```tsx
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <Text className="text-text-primary text-xl">Creed</Text>
    </View>
  );
}
```
Run: `pnpm --filter @creed/mobile exec expo start --ios`
Expected: pantalla con fondo `#F6F7FA` y texto "Creed" oscuro centrado.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-native apps/mobile pnpm-lock.yaml
git commit -m "feat(ui-native): preset de tokens + NativeWind en mobile"
```

---

### Task 4: Primitivas de `ui-native` (Screen, Surface, Button, Text)

**Files:**
- Create: `packages/ui-native/src/Screen.tsx`, `Surface.tsx`, `Text.tsx`, `Button.tsx`, `Button.test.tsx`
- Modify: `packages/ui-native/src/index.ts`

**Interfaces:**
- Consumes: tokens NativeWind del preset (Task 3).
- Produces:
  - `Screen({ children, className })` — SafeAreaView con `bg-canvas`.
  - `Surface({ children, className })` — tarjeta `bg-surface` con borde y radius lg.
  - `AppText({ children, variant, className })` — `variant: 'title' | 'body' | 'muted'`.
  - `Button({ label, onPress, loading, disabled, variant })` — `variant: 'primary' | 'ghost'`.

- [ ] **Step 1: Escribir el test del Button (debe fallar)**

Crear `packages/ui-native/src/Button.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from './Button';

test('renderiza el label y dispara onPress al tocar', () => {
  const onPress = jest.fn();
  render(<Button label="Entrar" onPress={onPress} />);
  fireEvent.press(screen.getByText('Entrar'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('no dispara onPress si loading', () => {
  const onPress = jest.fn();
  render(<Button label="Entrar" onPress={onPress} loading />);
  fireEvent.press(screen.getByTestId('button'));
  expect(onPress).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Ejecutar el test desde mobile (debe fallar)**

Run (el test corre bajo el harness de la app, que ya transpila `nativewind`):
```bash
pnpm --filter @creed/mobile exec jest ../../packages/ui-native/src/Button.test.tsx
```
Expected: FAIL — `Cannot find module './Button'`.

- [ ] **Step 3: Implementar las primitivas**

Crear `packages/ui-native/src/Text.tsx`:
```tsx
import { Text as RNText, TextProps } from 'react-native';

type Variant = 'title' | 'body' | 'muted';
const styles: Record<Variant, string> = {
  title: 'text-text-primary text-2xl font-semibold',
  body: 'text-text-primary text-base',
  muted: 'text-text-muted text-sm',
};

export function AppText({ variant = 'body', className = '', ...props }: TextProps & { variant?: Variant }) {
  return <RNText className={`${styles[variant]} ${className}`} {...props} />;
}
```

Crear `packages/ui-native/src/Surface.tsx`:
```tsx
import { View, ViewProps } from 'react-native';

export function Surface({ className = '', ...props }: ViewProps) {
  return <View className={`bg-surface border border-border rounded-lg p-5 ${className}`} {...props} />;
}
```

Crear `packages/ui-native/src/Screen.tsx`:
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { ViewProps } from 'react-native';

export function Screen({ className = '', ...props }: ViewProps) {
  return <SafeAreaView className={`flex-1 bg-canvas px-5 ${className}`} {...props} />;
}
```

Crear `packages/ui-native/src/Button.tsx`:
```tsx
import { Pressable, Text, ActivityIndicator, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, onPress, loading = false, disabled = false, variant = 'primary' }: Props) {
  const isPrimary = variant === 'primary';
  const inactive = loading || disabled;
  return (
    <Pressable
      testID="button"
      accessibilityRole="button"
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      className={`h-12 rounded-lg items-center justify-center ${isPrimary ? 'bg-accent' : 'bg-transparent'} ${inactive ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FCFCFD' : '#4F62E0'} />
      ) : (
        <View>
          <Text className={`text-base font-semibold ${isPrimary ? 'text-text-on-accent' : 'text-accent'}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
```

Crear `packages/ui-native/src/index.ts`:
```ts
export { Screen } from './Screen';
export { Surface } from './Surface';
export { AppText } from './Text';
export { Button } from './Button';
```

- [ ] **Step 4: Ejecutar los tests (deben pasar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest ../../packages/ui-native/src/Button.test.tsx
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-native/src
git commit -m "feat(ui-native): primitivas Screen/Surface/Text/Button"
```

---

### Task 5: Cliente Supabase RN + helpers de auth

**Files:**
- Create: `apps/mobile/lib/supabase.ts`, `apps/mobile/lib/auth.ts`, `apps/mobile/lib/auth.test.ts`, `apps/mobile/.env.local`
- Modify: `apps/mobile/.gitignore`

**Interfaces:**
- Produces:
  - `supabase` — cliente `SupabaseClient` con AsyncStorage.
  - `sendOtp(email: string): Promise<{ error: string | null }>`
  - `verifyOtp(email: string, code: string): Promise<{ error: string | null }>`
  - `signOut(): Promise<void>`

- [ ] **Step 1: Instalar dependencias del cliente**

Run:
```bash
pnpm --filter @creed/mobile add @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

- [ ] **Step 2: Crear el cliente**

Crear `apps/mobile/lib/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Env vars locales** (copiar valores del proyecto Supabase existente)

Crear `apps/mobile/.env.local` (mismos valores que los `NEXT_PUBLIC_SUPABASE_*` de la web):
```
EXPO_PUBLIC_SUPABASE_URL=<mismo valor que NEXT_PUBLIC_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<mismo valor que NEXT_PUBLIC_SUPABASE_ANON_KEY>
```
Asegurar que `apps/mobile/.gitignore` ignora `.env*.local` (Expo lo añade por defecto; si no, añadir la línea `.env.local`).

- [ ] **Step 4: Escribir el test de los helpers (debe fallar)**

Crear `apps/mobile/lib/auth.test.ts`:
```ts
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { supabase } from './supabase';
import { sendOtp, verifyOtp } from './auth';

test('sendOtp llama a signInWithOtp con shouldCreateUser', async () => {
  const res = await sendOtp('Test@Mail.com ');
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'test@mail.com',
    options: { shouldCreateUser: true },
  });
  expect(res.error).toBeNull();
});

test('verifyOtp rechaza códigos que no son 6 dígitos sin llamar a la API', async () => {
  const res = await verifyOtp('test@mail.com', '12a');
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  expect(res.error).toBe('invalid_code');
});

test('verifyOtp llama a la API con type email para un código válido', async () => {
  const res = await verifyOtp('test@mail.com', '123456');
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
    email: 'test@mail.com',
    token: '123456',
    type: 'email',
  });
  expect(res.error).toBeNull();
});
```

- [ ] **Step 5: Ejecutar (debe fallar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest lib/auth.test.ts
```
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 6: Implementar los helpers**

Crear `apps/mobile/lib/auth.ts`:
```ts
import { supabase } from './supabase';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function sendOtp(email: string): Promise<{ error: string | null }> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return { error: 'invalid_email' };
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  return { error: error ? 'send_failed' : null };
}

export async function verifyOtp(email: string, code: string): Promise<{ error: string | null }> {
  const normalized = normalizeEmail(email);
  if (!/^\d{6}$/.test(code.trim())) return { error: 'invalid_code' };
  const { error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: code.trim(),
    type: 'email',
  });
  return { error: error ? 'invalid_code' : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
```

- [ ] **Step 7: Ejecutar (deben pasar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest lib/auth.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib apps/mobile/.gitignore
git commit -m "feat(mobile): cliente Supabase RN + helpers de auth OTP"
```

---

### Task 6: AuthProvider, gate de navegación y pantallas de auth

**Files:**
- Create: `apps/mobile/lib/auth-context.tsx`, `apps/mobile/lib/auth-context.test.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/verify.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`, `app/(app)/index.tsx`
- Modify: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`

**Interfaces:**
- Consumes: `sendOtp`, `verifyOtp`, `signOut` (Task 5); `Screen`, `Button`, `AppText` (Task 4).
- Produces: `AuthProvider`, `useAuth(): { session, loading }`; gate que envía sin-sesión → `/(auth)/login` y con-sesión → `/(app)`.

- [ ] **Step 1: Escribir el test del provider (debe fallar)**

Crear `apps/mobile/lib/auth-context.test.tsx`:
```tsx
const listeners: Array<(e: string, s: unknown) => void> = [];
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  },
}));

import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from './auth-context';

function Probe() {
  const { session, loading } = useAuth();
  if (loading) return <Text>loading</Text>;
  return <Text>{session ? 'in' : 'out'}</Text>;
}

test('arranca en loading y resuelve a out sin sesión', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('out')).toBeOnTheScreen());
});

test('pasa a in cuando llega una sesión por onAuthStateChange', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('out')).toBeOnTheScreen());
  act(() => listeners.forEach((cb) => cb('SIGNED_IN', { user: { id: 'u1' } })));
  await waitFor(() => expect(screen.getByText('in')).toBeOnTheScreen());
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest lib/auth-context.test.tsx
```
Expected: FAIL — `Cannot find module './auth-context'`.

- [ ] **Step 3: Implementar el AuthProvider**

Crear `apps/mobile/lib/auth-context.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next as Session | null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 4: Ejecutar (deben pasar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest lib/auth-context.test.tsx
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Root layout con AuthProvider + autorefresh en foreground**

Reemplazar `apps/mobile/app/_layout.tsx`:
```tsx
import '../global.css';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: Redirección raíz según sesión**

Reemplazar `apps/mobile/app/index.tsx`:
```tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#4F62E0" />
      </View>
    );
  }
  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />;
}
```

- [ ] **Step 7: Stack de auth + pantalla de login**

Crear `apps/mobile/app/(auth)/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Crear `apps/mobile/app/(auth)/login.tsx`:
```tsx
import { useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button } from '@creed/ui-native';
import { sendOtp } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await sendOtp(email);
    setLoading(false);
    if (error) return setError('No pudimos enviar el código. Revisa el email.');
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
  }

  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Entra en Creed</AppText>
      <AppText variant="muted">Te enviamos un código de 6 dígitos a tu email.</AppText>
      <TextInput
        testID="email-input"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        className="h-12 rounded-lg border border-border px-4 text-text-primary"
      />
      {error ? <AppText className="text-status-red">{error}</AppText> : null}
      <Button label="Enviar código" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
```

- [ ] **Step 8: Pantalla de verificación**

Crear `apps/mobile/app/(auth)/verify.tsx`:
```tsx
import { useState } from 'react';
import { TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button } from '@creed/ui-native';
import { verifyOtp } from '../../lib/auth';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email ?? '', code);
    setLoading(false);
    // Con éxito, onAuthStateChange actualiza la sesión y el gate redirige solo.
    if (error) setError('Código inválido. Inténtalo de nuevo.');
  }

  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Tu código</AppText>
      <AppText variant="muted">Enviado a {email}</AppText>
      <TextInput
        testID="code-input"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        className="h-12 rounded-lg border border-border px-4 text-text-primary text-2xl tracking-widest"
      />
      {error ? <AppText className="text-status-red">{error}</AppText> : null}
      <Button label="Verificar" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
```

- [ ] **Step 9: Grupo `(app)` con gate + pantalla Hoy**

Crear `apps/mobile/app/(app)/_layout.tsx`:
```tsx
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/auth-context';

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#4F62E0" />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Crear `apps/mobile/app/(app)/index.tsx`:
```tsx
import { Screen, AppText, Button } from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Hoy</AppText>
      <AppText variant="muted">Estás dentro. Aquí vivirá tu día de entreno.</AppText>
      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
```

- [ ] **Step 10: Probar el flujo completo en el simulador**

Run: `pnpm --filter @creed/mobile exec expo start --ios`
Manual:
1. Arranca → ves `/login` (no hay sesión).
2. Metes tu email real → "Enviar código" → navega a `/verify`.
3. Metes el código del email → "Verificar" → el gate te lleva a "Hoy".
4. "Cerrar sesión" → vuelves a `/login`.
5. Cierra y reabre la app → sigues en "Hoy" (sesión persistida en AsyncStorage).

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/lib apps/mobile/app
git commit -m "feat(mobile): auth OTP end-to-end + gate de navegación"
```

---

### Task 7: EAS Build + TestFlight (gated: requiere cuenta Apple Developer)

**Files:**
- Create: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Produces: la app instalable en iPhone vía TestFlight.

> **Gate:** esta tarea necesita una cuenta Apple Developer activa. Si aún no existe, completar Tareas 1-6 y dejar esta para cuando la cuenta esté lista. Mientras tanto, `expo start --ios` en simulador cubre la verificación funcional.

- [ ] **Step 1: Identidad de la app en `app.json`**

Editar `apps/mobile/app.json` → en `expo`: `name: "Creed"`, `slug: "creed"`, y añadir `ios.bundleIdentifier`:
```json
{
  "expo": {
    "name": "Creed",
    "slug": "creed",
    "scheme": "creed",
    "ios": { "bundleIdentifier": "com.creed.app", "supportsTablet": false }
  }
}
```

- [ ] **Step 2: Instalar EAS CLI y loguear**

Run:
```bash
pnpm --filter @creed/mobile add -D eas-cli
pnpm --filter @creed/mobile exec eas login
```
Expected: login con la cuenta Expo.

- [ ] **Step 3: Inicializar EAS y crear `eas.json`**

Run:
```bash
pnpm --filter @creed/mobile exec eas build:configure -p ios
```
Verificar que `apps/mobile/eas.json` tiene perfiles `development`, `preview`, `production`. Asegurar el perfil `preview` con build interno:
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "ios": { "simulator": false } },
    "production": {}
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 4: Build de preview para dispositivo**

Run:
```bash
pnpm --filter @creed/mobile exec eas build -p ios --profile preview
```
Expected: EAS provisiona credenciales (pide el Apple Developer account), compila en la nube y devuelve un build instalable. Instalar en el iPhone y verificar login real.

- [ ] **Step 5: Submit a TestFlight**

Run:
```bash
pnpm --filter @creed/mobile exec eas build -p ios --profile production
pnpm --filter @creed/mobile exec eas submit -p ios --latest
```
Expected: el build aparece en App Store Connect → TestFlight. Instalar vía TestFlight en el iPhone.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app.json apps/mobile/eas.json apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): EAS build config + submit iOS"
```

---

## Criterio de salida de la Fase 1

- [ ] `pnpm --filter @creed/mobile exec expo start --ios` arranca la app en simulador sin errores.
- [ ] Login real (OTP email) funciona end-to-end y la sesión persiste tras reabrir.
- [ ] `pnpm --filter @creed/mobile test` verde (Button, auth helpers, auth-context).
- [ ] `pnpm --filter @creed/web typecheck` sigue verde (web intacta).
- [ ] (Gated) La app corre en el iPhone físico vía TestFlight.

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 1):** Expo en monorepo (T1) ✓ · `ui-native` NativeWind + tokens (T3, T4) ✓ · auth Supabase OTP (T5, T6) ✓ · navegación + gate (T6) ✓ · EAS→TestFlight (T7) ✓. Criterio de salida del spec ("arranca en iPhone vía TestFlight; login real funciona") cubierto por T6 (login) + T7 (TestFlight).
- **Placeholders:** ninguno — todo el código real; los `<mismo valor que…>` en `.env.local` son valores secretos del autor, intencionadamente no incrustados.
- **Consistencia de tipos:** `sendOtp`/`verifyOtp`/`signOut` (T5) consumidos con la misma firma en T6. `useAuth(): { session, loading }` definido en T6 y consumido en `index.tsx` y `(app)/_layout.tsx`. Primitivas `Screen/Button/AppText` (T4) usadas con las props declaradas. Tokens (`bg-canvas`, `text-text-primary`, `bg-accent`, `border-border`, `text-status-red`, `text-text-on-accent`, `text-text-muted`) definidos en el preset de T3.
- **Riesgo conocido:** pnpm+Metro (mitigado con `.npmrc node-linker=hoisted` + metro monorepo config; T1 step 7 verifica que la web no se rompe). NativeWind v4 ↔ Tailwind 3.4 (fijado `tailwindcss@3.4.17`).
