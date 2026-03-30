import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import localFont from "next/font/local";
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

const script = localFont({
  src: "./fonts/Licorice-Regular.ttf",
  variable: "--font-script",
  display: "swap",
  weight: "400",
});

const caveat = localFont({
  src: "./fonts/Caveat-VariableFont_wght.ttf",
  variable: "--font-caveat",
  display: "swap",
});

const instrumentSerif = localFont({
  src: "./fonts/InstrumentSerif-Italic.ttf",
  variable: "--font-serif",
  display: "swap",
  weight: "400",
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
  themeColor: "#5c3d2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${body.variable} ${heading.variable} ${script.variable} ${caveat.variable} ${instrumentSerif.variable}`}>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          richColors
          duration={3000}
          toastOptions={{
            style: {
              background: "#3d2810",
              color: "#faf7f3",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "0 8px 30px rgba(61,40,16,0.25)",
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
