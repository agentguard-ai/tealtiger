import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'TealTiger AI SDK Next.js Example',
  description: 'Next.js App Router chat example governed by TealTiger AI SDK middleware.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
