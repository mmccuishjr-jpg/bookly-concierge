import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bookly Concierge | Support that discovers',
  description: 'A trustworthy customer agent for grounded support, Airtable-backed actions, and personalized book discovery.',
  openGraph: {
    title: 'Bookly Concierge',
    description: 'Grounded customer support that also helps readers discover what to buy next.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Bookly Support — AI customer care that acts without guessing.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bookly Concierge',
    description: 'Grounded customer support that also helps readers discover what to buy next.',
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
