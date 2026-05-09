import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Creed',
    short_name: 'Creed',
    description:
      'Plataforma personal de coaching físico con datos de Whoop y dos agentes AI coordinados.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#dbe7f4',
    theme_color: '#dbe7f4',
    categories: ['fitness', 'health', 'lifestyle'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
