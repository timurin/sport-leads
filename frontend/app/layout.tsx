import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sport-Lead",
  description: "Учёт производства и продаж",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
