import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "acryl508.osxcode.chatgpt.site";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = new URL(`${protocol}://${host}`);
  const description = "Less enclosure. More possibility. Shape your own GS acrylic Eurorack case with a live 3D preview.";
  return {
    metadataBase: origin,
    title: { default: "Acryl508 — Eurorack Case Creator", template: "%s · Acryl508" },
    description,
    openGraph: { title: "acryl508. — The open case system", description, type: "website", images: [{ url: new URL("/og.png", origin).href, width: 1733, height: 907, alt: "acryl508. Less enclosure. More possibility. A transparent orange acrylic Eurorack case." }] },
    twitter: { card: "summary_large_image", title: "acryl508. — The open case system", description, images: [new URL("/og.png", origin).href] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <body className={`${geistSans.variable} ${geistMono.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('acryl508-theme');document.documentElement.classList.toggle('dark',t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}})()` }} />
      <TooltipProvider>{children}</TooltipProvider>
    </body>
  </html>;
}
