import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZANKU",
  description:
    "Cola de brigadistas antidengue a partir de cortes de agua + captura entomológica (HI/CI/BI)",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/zanku-circle.png", type: "image/png" }],
    apple: [{ url: "/icons/zanku-circle-180.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZANKU",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8FAFC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${atkinson.variable} font-sans`}>{children}</body>
    </html>
  );
}
