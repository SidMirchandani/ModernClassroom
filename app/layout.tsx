import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { PointerTracker } from "@/components/PointerTracker";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * One typeface, everywhere: Poppins, for headings, body, labels, numbers and
 * code alike. A single geometric face is what keeps a flat interface calm —
 * hierarchy comes from size, weight and grey, never from switching families.
 * Not a variable font, so the weights are listed — and there are only two:
 * nothing in the interface is heavier than medium (see tailwind.config.ts).
 */
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-sans",
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
      className={poppins.variable}
      // Smooth scrolling is on in globals.css; this tells Next to switch it
      // off for the instant jump to the top on navigation.
      data-scroll-behavior="smooth"
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
          <PointerTracker />
          <div id="app-root">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
