import type {
  Metadata,
} from 'next';

import {
  Geist,
  Geist_Mono,
} from 'next/font/google';

import {
  AppProviders,
} from '@/components/providers/app-providers';

import './globals.css';

const geistSans =
  Geist({
    variable:
      '--font-geist-sans',

    subsets: [
      'latin',
    ],
  });

const geistMono =
  Geist_Mono({
    variable:
      '--font-geist-mono',

    subsets: [
      'latin',
    ],
  });

export const metadata:
  Metadata = {
    title: {
      default:
        'OpsDesk',

      template:
        '%s | OpsDesk',
    },

    description:
      'Customer support and CRM for small teams.',
  };

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased"
      >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}