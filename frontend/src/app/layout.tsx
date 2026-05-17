import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compte à Rebours',
  description: 'Application de compte à rebours en temps réel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
