import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bookly Support | AI customer concierge',
  description: 'A trustworthy AI support agent that resolves order and return requests without guessing.',
  openGraph: {
    title: 'Bookly Support',
    description: 'AI customer care that acts without guessing.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Bookly Support — AI customer care that acts without guessing.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bookly Support',
    description: 'AI customer care that acts without guessing.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
