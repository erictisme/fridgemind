import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/lib/posthog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FridgeMind - AI Food Management",
  description: "Scan your fridge, get recipe ideas, track nutrition, and never waste food again. AI-powered kitchen assistant.",
  openGraph: {
    title: "FridgeMind",
    description: "Know what's in your kitchen. Cook with confidence.",
    siteName: "FridgeMind",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "FridgeMind",
    description: "AI-powered food management. Scan, cook, track.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
