import type { Metadata } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import "./globals.css";

const overpass = Overpass({ subsets: ["latin"], variable: "--font-overpass", display: "swap" });
const overpassMono = Overpass_Mono({ subsets: ["latin"], variable: "--font-overpass-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Emission Lens",
  description: "Estimated intersection emissions from public cameras. Not a measured air-quality index.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
