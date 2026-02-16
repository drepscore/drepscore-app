import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/utils/wallet";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DRepScore - Find Your Ideal Cardano DRep",
  description: "Discover and delegate to Cardano DReps aligned with your values. Compare participation rates, voting history, and decentralization scores.",
  keywords: ["Cardano", "DRep", "Governance", "Delegation", "ADA", "Blockchain", "Voting"],
  openGraph: {
    title: "DRepScore - Find Your Ideal Cardano DRep",
    description: "Discover and delegate to Cardano DReps aligned with your values",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <WalletProvider>
            <Header />
            <main className="min-h-screen">
              {children}
            </main>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
