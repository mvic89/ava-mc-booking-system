import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BikeMenuNow",
  description: "Motorcycle enterprise booking system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen">
          <aside className="w-52 border-r border-neutral-800 bg-neutral-950 p-4">
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-mono mb-4">Clients</p>
            <nav className="flex flex-col gap-1">
              <Link href="/ava-mc" className="text-sm text-neutral-300 hover:text-white px-3 py-2 rounded hover:bg-neutral-800 transition-colors">
                AVA MC
              </Link>
              <Link href="/bikemenow" className="text-sm text-neutral-300 hover:text-white px-3 py-2 rounded hover:bg-neutral-800 transition-colors">
                BikeMenuNow
              </Link>
            </nav>
          </aside>
          <main className="flex-1 bg-neutral-900">{children}</main>
        </div>
      </body>
    </html>
  );
}
