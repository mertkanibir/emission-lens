import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emission Lens",
  description: "Estimated intersection emissions from public cameras. Not a measured air-quality index.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="site-header">
            <div>
              <p className="eyebrow">Torrance intersections</p>
              <h1>Emission Lens</h1>
            </div>
            <nav className="site-nav" aria-label="Sections">
              <Link href="/">Overview</Link>
              <Link href="/review">Review</Link>
              <Link href="/brief">Brief</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
