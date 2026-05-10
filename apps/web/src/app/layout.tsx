import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PC2CLOUD Dashboard",
  description: "Private cloud device dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
