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
  title: "AuditHalo — Clinical Supervision Compliance",
  description:
    "Track supervision hours, generate AI-assisted session notes, capture e-signatures with intent, and publish tamper-evident audit packages for state licensing boards.",
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
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <NextTopLoader
            color="#166534"
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
