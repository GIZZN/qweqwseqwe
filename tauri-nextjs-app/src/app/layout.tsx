import type { Metadata } from "next";
import "./globals.css";
import StandardCursor from "./components/StandardCursor";

export const metadata: Metadata = {
  title: "Tauri Next.js App",
  description: "Tauri Next.js App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StandardCursor>
          {children}
        </StandardCursor>
      </body>
    </html>
  );
}
