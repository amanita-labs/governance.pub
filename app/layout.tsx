import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/layout/WalletProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Navigation from "@/components/layout/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GovTwool - Cardano Governance",
  description: "A playful Cardano governance application",
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <ThemeProvider defaultTheme="system" storageKey="govtwool-theme">
          <WalletProvider>
            <Navigation />
            {children}
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

