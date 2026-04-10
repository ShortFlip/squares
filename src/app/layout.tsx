import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PlayerProvider } from '@/components/game/PlayerProvider';
import { Toaster } from 'sonner';
import './globals.css';

// Display/headers — bold and characterful for "Arcade Lounge" feel
const outfit = Outfit({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

// Body/UI — clean geometric sans
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Monospace — room codes, stats, timestamps
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Squares',
  description: 'Real-time multiplayer bingo for your friend group.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark mode is the default — apply class here so CSS vars resolve correctly
    <html
      lang="en"
      className={`dark ${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* TooltipProvider required at root for all shadcn Tooltip components */}
        <TooltipProvider>
          <PlayerProvider>
            {children}
          </PlayerProvider>
          <Toaster theme="dark" position="bottom-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
