import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Duta Teknokrat 2026 | Sistem Penilaian', description: 'Sistem pengolahan nilai Duta Teknokrat 2026' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
