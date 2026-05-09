import Navigation from "../components/navigation";
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Gymi Preparation Course Scoring System',
  description: 'Gymi Preparation Course Scoring System - A tool to compare preparation course providers'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className={GeistSans.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <main className="min-h-screen flex flex-col items-center">
            <Navigation />
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
