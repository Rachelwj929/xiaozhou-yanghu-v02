import type { Metadata, Viewport } from 'next';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/xiaozhou-yanghu-v02';

export const metadata: Metadata = {
  title: '小周养护 V0.2',
  description: '天然食物、阳光和活动优先的本地养护记录。',
  applicationName: '小周养护 V0.2',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '小周养护 V0.2',
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon.png`, sizes: '64x64', type: 'image/png' },
      { url: `${basePath}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#28513d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
