import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "./fonts/manrope.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "200 800",
});
const editorial = localFont({
  src: "./fonts/lora-italic.ttf",
  variable: "--font-editorial",
  display: "swap",
  weight: "400 700",
  style: "italic",
});

export const metadata: Metadata = {
  title: "Emission Lens",
  description:
    "Estimated intersection emissions from public cameras. Not a measured air-quality index.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${editorial.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
