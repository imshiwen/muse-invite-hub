import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CONTENT_PAGE_SLUGS,
  SITE_NAME,
  SITE_URL,
  getCanonicalUrl,
  getContentPage,
  type ContentPageSlug,
} from "@/lib/content";

type ContentRouteProps = {
  params: Promise<{ slug: string }>;
};

const RELATED_LINKS: Record<
  ContentPageSlug,
  Array<{ href: string; label: string }>
> = {
  redeem: [
    { href: "/how-to-register", label: "How to join Muse" },
    { href: "/region-limits", label: "Regional availability" },
    { href: "/share", label: "Share a code" },
  ],
  "how-to-register": [
    { href: "/region-limits", label: "Regional availability" },
    { href: "/redeem", label: "How to redeem a code" },
    { href: "/share", label: "Share a code" },
  ],
  "region-limits": [
    { href: "/how-to-register", label: "How to join Muse" },
    { href: "/redeem", label: "How code redemption works" },
    { href: "/about", label: "About this directory" },
  ],
  about: [
    { href: "/how-to-register", label: "How to join Muse" },
    { href: "/privacy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of use" },
    { href: "/contact", label: "Contact" },
  ],
  privacy: [
    { href: "/terms", label: "Terms of use" },
    { href: "/contact", label: "Contact" },
    { href: "/about", label: "About this directory" },
  ],
  terms: [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/share", label: "Share a code" },
    { href: "/contact", label: "Contact" },
  ],
  contact: [
    { href: "/about", label: "About this directory" },
    { href: "/privacy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of use" },
  ],
};

export function generateStaticParams() {
  return CONTENT_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ContentRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getContentPage(slug);

  if (!page) {
    return {
      title: "Page not found | " + SITE_NAME,
      robots: { index: false, follow: false },
    };
  }

  const canonical = getCanonicalUrl(slug as ContentPageSlug);

  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.title,
      description: page.description,
      url: canonical,
      siteName: SITE_NAME,
      type: "article",
    },
  };
}

export default async function ContentPageRoute({
  params,
}: ContentRouteProps) {
  const { slug } = await params;
  const page = getContentPage(slug);

  if (!page) notFound();

  const canonical = getCanonicalUrl(slug as ContentPageSlug);
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL + "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.heading,
        item: canonical,
      },
    ],
  };
  const safeBreadcrumbData = JSON.stringify(breadcrumbData).replace(
    /</g,
    "\\u003c",
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeBreadcrumbData }}
      />
      <main id="main" className="article-page">
        <header className="article-hero">
          <div className="container">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <ol className="breadcrumb-list">
                <li>
                  <a href="/">Home</a>
                </li>
                <li aria-current="page">
                  <span>{page.heading}</span>
                </li>
              </ol>
            </nav>
            <p className="article-eyebrow">Independent community guide</p>
            <h1 id="article-title">{page.heading}</h1>
            <p className="article-intro">{page.intro}</p>
          </div>
        </header>
        <div className="container article-layout">
          <article className="article-body" aria-labelledby="article-title">
            {page.body}
          </article>
          <aside className="article-aside">
            {page.aside}
            <nav className="related-links" aria-label="Related pages">
              <h2>Explore more</h2>
              <ul>
                {RELATED_LINKS[slug as ContentPageSlug].map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </main>
    </>
  );
}
