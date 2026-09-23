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
  const title = "acryl508. — Eurorack Case Configurator";
  const description = "Design your own GS acrylic Eurorack case with a live 3D preview. Explore dimensions, colours and construction, then export your configuration.";
  const socialImage = {
    url: new URL("/og.png", origin).href,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: "acryl508. Eurorack case configurator — exploded view of a signal-orange acrylic case with black rails, handle and removable feet.",
  };
  return {
    metadataBase: origin,
    applicationName: "acryl508.",
    title: { default: title, template: "%s · acryl508." },
    description,
    alternates: { canonical: "/" },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
        { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin.href,
      siteName: "acryl508.",
      locale: "en_US",
      images: [socialImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
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
