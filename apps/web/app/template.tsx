// app/template.tsx — wrapper que se remonta en cada navegación de App Router.
// Permite animar la entrada de cada ruta sin tocar cada page.tsx individual.
// La animación se define en globals.css (`.page-transition`).

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
