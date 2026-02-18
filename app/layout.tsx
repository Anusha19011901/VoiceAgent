import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Captain Calendork',
  description: 'Voice Scheduling Agent with Google Calendar'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
