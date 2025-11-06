import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Cheddar CRM - Private Markets",
  description: "AI-powered CRM for private markets investors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={dmSans.className}>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

