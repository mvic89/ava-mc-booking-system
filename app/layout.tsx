import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getLocale} from 'next-intl/server';
import { Toaster } from 'sonner';
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import RealtimeSync from "@/components/RealtimeSync";
import { InventoryProvider } from "@/context/InventoryContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BikeMeNow — Dealership Platform",
  description: "SaaS dealership management platform for motorcycle dealers in Sweden",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} translate="no" className="notranslate">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <InventoryProvider>
            <RealtimeSync />
            <Sidebar />
            {children}
          </InventoryProvider>
        </NextIntlClientProvider>
        <Toaster
          position="bottom-right"
          richColors
          toastOptions={{ style: { fontFamily: 'var(--font-geist-sans)' } }}
        />
      </body>
    </html>
  );
}
