import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio · AI Agent",
  description: "Enterprise AI Agent Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Sarabun:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
