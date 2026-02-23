import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HeaderClient } from "@/components/HeaderClient";
import { DelegationInsightBannerClient } from "@/components/DelegationInsightBannerClient";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/Providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

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
  description: "Discover and delegate to Cardano DReps aligned with your values. Compare accountability scores, voting records, and value alignment.",
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
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <HeaderClient />
            <DelegationInsightBannerClient />
            <main className="min-h-screen">
              {children}
            </main>
          </Providers>
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
