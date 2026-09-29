import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import "./relay-theme.css";
import { SITE_URL } from "@/lib/config";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Muse Invite Codes | Muse Invite Hub",
    template: "%s | Muse Invite Hub",
  },
  description:
    "Browse community-listed Muse invite codes and share one of your own. No account is needed to submit a code.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Muse Invite Hub",
    locale: "en_US",
    images: [
      {
        url: "/social-card.png",
        width: 1200,
        height: 630,
        alt: "Muse invite codes. Copy a free code. Get more Muse tokens.",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
