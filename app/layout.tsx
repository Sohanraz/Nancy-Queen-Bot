import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nancy Queen · Bot Dashboard",
  description: "Nancy Queen Telegram channel automation dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
