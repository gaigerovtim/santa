import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import { fontDisplay, fontMono, fontSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: site.name, template: `%s — ${site.name}` },
  description: site.description,
  openGraph: {
    title: site.name,
    description: site.description,
    type: "website",
    locale: "ru_RU",
    images: ["/media/example-poster.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0E1424",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
