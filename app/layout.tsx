import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Two faces, one voice. Inter carries every piece of interface text — it was
 * drawn for screens at exactly the 11–14px this app lives at. Archivo is the
 * display cut: tighter, heavier, used only where something is announcing
 * itself. Both are flat grotesques, so headings read as the same family
 * speaking louder rather than as a second design.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Modern Classroom — self-paced learning, teacher oversight",
    template: "%s · Modern Classroom",
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "Modern Classroom — self-paced learning, teacher oversight",
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Modern Classroom",
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('modern-classroom-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');}catch(e){}})();`,
          }}
        />
        {/* Everything the app renders lives in here; overlays portal out to
            <body>, so blurring this one element blurs the page — chrome
            included — without touching the popup on top of it. */}
        <ThemeProvider>
          <div id="app-root">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
