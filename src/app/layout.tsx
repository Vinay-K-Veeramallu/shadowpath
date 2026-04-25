import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { HighContrastProvider } from "../../contexts/HighContrastContext";
import { Nav } from "../../components/Nav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ShadowPath — Heat-Safe Campus Routing",
  description: "Navigate ASU Tempe campus safely during extreme heat with shade-aware and cooling-stop routes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-slate-900`}
      >
        <HighContrastProvider>
          <Nav />
          <main id="main-content">
            {children}
          </main>
        </HighContrastProvider>
      </body>
    </html>
  );
}
