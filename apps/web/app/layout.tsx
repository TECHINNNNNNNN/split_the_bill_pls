import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const body = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const heading = Prompt({
  variable: "--font-heading",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlaDuk — หารบิลง่ายๆ",
  description: "Split bills with friends. No app download needed.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${body.variable} ${heading.variable}`}>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          richColors
          duration={3000}
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#f8fafc",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
              width: "fit-content",
              maxWidth: "90vw",
              textAlign: "center",
            },
          }}
        />
      </body>
    </html>
  );
}
