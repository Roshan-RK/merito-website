import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Script from "next/script";
import ClientAnalytics from "@/components/ClientAnalytics";
import SalesIqWidget from "@/components/SalesIqWidget";
import { siteUrl } from "@/lib/site";

// Loaded fonts are Manrope/Space Grotesk (matching the hub dashboard mockup),
// but kept on the --font-poppins/--font-gabarito CSS variable names below --
// those names are referenced by identifier (not value) in 60+ files across
// the app, so renaming them would be a repo-wide diff for a font change that
// only needs the value swapped. Neither font has an italic cut on Google
// Fonts, unlike the Poppins it replaces.
const poppins = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const gabarito = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-gabarito",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Merito — AI-Enabled Full-Funnel Recruitment Partner",
    template: "%s | Merito",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  description: "Merito is a human-centric AI recruitment agency that blends strategic human insight with a proprietary Skill-based Hiring Platform. No resume spam. No gut-feel guesses.",
  keywords: [
    "recruitment agency",
    "AI recruitment",
    "talent acquisition",
    "skill-based hiring",
    "executive search",
    "India hiring",
  ],
  authors: [{ name: "Merito", url: siteUrl }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Merito",
    title: "Merito — AI-Enabled Full-Funnel Recruitment Partner",
    description: "Human-centric AI recruitment agency. 48-hour sourcing. Top 2% talent.",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Merito — AI Recruitment Partner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Merito — AI Recruitment Partner",
    description: "Human-centric AI recruitment. 48-hour sourcing.",
    images: ["/logo.png"],
  },
  robots: {
    index: process.env.NEXT_PUBLIC_ENV !== "staging",
    follow: process.env.NEXT_PUBLIC_ENV !== "staging",
    googleBot: {
      index: process.env.NEXT_PUBLIC_ENV !== "staging",
      follow: process.env.NEXT_PUBLIC_ENV !== "staging",
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFY ?? "",
  },
  alternates: {
    canonical: "./",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-head" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');`}
        </Script>
        {/* JSON-LD Schema Markup */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Merito",
              "alternateName": "Career Corner Education Pvt. Ltd",
              "url": siteUrl,
              "logo": `${siteUrl}/logo.png`,
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+91 97676-63123",
                "contactType": "customer service",
                "email": "admin@merito.ai",
                "areaServed": "IN",
                "availableLanguage": "en"
              },
              "sameAs": [
                "https://www.linkedin.com/company/merito-ai"
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Service",
              "serviceType": "AI Recruitment Agency",
              "provider": {
                "@type": "Organization",
                "name": "Merito"
              },
              "areaServed": {
                "@type": "Country",
                "name": "India"
              },
              "description": "Human-centric AI recruitment agency blending strategic human insight with a proprietary Skill-based Hiring Platform to deliver top 2% talent in 48 hours.",
              "offers": {
                "@type": "Offer",
                "description": "AI Consulting and Agency Partner models"
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is Merito's approach to hiring?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Merito uses an AI-powered precision hiring approach, screening and shortlisting only the top 2% of talent using advanced data and behavioral insights."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How much can Merito reduce time-to-hire?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Merito typically delivers a 60% reduction in time-to-hire compared to traditional recruitment processes."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What proprietary tools does Merito use?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Merito uses unique tools like Ref-Track and AI-driven workflows to eliminate hiring risks and evaluate candidate reputation."
                  }
                }
              ]
            })
          }}
        />
      </head>
      <body className={`${poppins.variable} ${gabarito.variable} antialiased`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
            height="0" width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Navbar />
          <ClientAnalytics />
          <SalesIqWidget />
          {children}
          <Footer />
      </body>
    </html>
  );
}

