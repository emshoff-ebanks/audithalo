import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { PostHogProvider } from "@/components/observability/posthog-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://audithalo.com"),
  title: "AuditHalo — Mental health supervision compliance",
  description:
    "Track pre-licensed mental health counselor supervision hours, generate AI-assisted session notes, capture e-signatures with intent, and publish tamper-evident audit packages for state licensing boards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Cabinet Grotesk is the display face (design-system-v2 §2.1). It is
          Fontshare-hosted, not on Google Fonts, so next/font can't load it.
          The @import in globals.css is stripped by Tailwind v4's Lightning CSS
          pipeline, so we load it with a real <link> here (matches the mockup).
        */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="preconnect"
          href="https://cdn.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <NextTopLoader
            color="#147A4A"
            height={2}
            showSpinner={false}
            shadow={false}
            crawlSpeed={200}
            initialPosition={0.15}
          />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
