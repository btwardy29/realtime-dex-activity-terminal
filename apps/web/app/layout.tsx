import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Realtime DEX Activity Terminal",
  description: "Realtime Base Sepolia DEX activity dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
