import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
};

export const viewport: Viewport = {
  themeColor: "#0E1424",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
