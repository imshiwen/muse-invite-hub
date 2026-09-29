import type { Metadata } from "next";
import { Header, Footer } from "@/components/shell";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <Footer privatePage />
    </>
  );
}
