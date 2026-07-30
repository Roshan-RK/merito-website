"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isHubAccountRoute } from "@/lib/hubRoutes";

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/meritoplatform/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/hire_with.merito/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/MeritoAi",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
];

export default function Footer() {
  const pathname = usePathname();

  if (isHubAccountRoute(pathname)) {
    return null;
  }

  return (
    <footer className="w-full bg-black text-white">
      <div className="mx-auto flex max-w-[1328px] flex-col gap-10 px-5 py-14 sm:px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-12 lg:flex-row lg:gap-20">
          <div className="flex max-w-[430px] flex-col gap-7">
            <Link href="/">
              <Image
                src="/logo-white.png"
                alt="Merito"
                width={121}
                height={60}
                className="h-[60px] w-auto object-contain"
                unoptimized
              />
            </Link>
            <p className="font-[family-name:var(--font-poppins)] text-[13px] md:text-[18px] font-medium leading-[1.38] text-white">
              Merito is an AI-enabled recruitment company that helps growth
              companies hire quality talent faster.
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-4 sm:gap-16 lg:gap-20">
            <div className="flex flex-col gap-3 md:gap-8">
              <span className="text-[13px] md:text-[18px] font-semibold text-[#ed1a24]">Company</span>
              <div className="flex flex-col gap-[6px] md:gap-5 text-[12px] md:text-[15px] font-medium">
                <Link href="/about" className="transition-colors hover:text-[#ed1a24]">
                  About us
                </Link>
                <Link href="/meritoways" className="transition-colors hover:text-[#ed1a24]">
                  Our Approach
                </Link>
                <Link
                  href="/contact"
                  className="text-left transition-colors hover:text-[#ed1a24]"
                >
                  Contact us
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:gap-8">
              <span className="text-[13px] md:text-[18px] font-semibold text-[#ed1a24]">Platform & tools</span>
              <div className="flex flex-col gap-[6px] md:gap-5 text-[12px] md:text-[15px] font-medium">
                <Link href="/ramp" className="transition-colors hover:text-[#ed1a24]">
                  RAMP
                </Link>
                <Link href="/offervault" className="transition-colors hover:text-[#ed1a24]">
                  OfferVault
                </Link>
                <Link href="/reftrack" className="transition-colors hover:text-[#ed1a24]">
                  Reftrack
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:gap-8">
              <span className="text-[13px] md:text-[18px] font-semibold text-[#ed1a24]">Insights</span>
              <div className="flex flex-col gap-[6px] md:gap-5 text-[12px] md:text-[15px] font-medium">
                <Link href="/insights" className="transition-colors hover:text-[#ed1a24]">
                  Articles
                </Link>
                <Link href="/insights" className="transition-colors hover:text-[#ed1a24]">
                  Podcasts
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center sm:items-start">
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 flex-shrink-0">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <a
              href="mailto:admin@merito.ai"
              className="text-[13px] sm:text-[15px] font-medium underline transition-colors hover:text-[#ed1a24]"
            >
              admin@merito.ai
            </a>
          </div>
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 flex-shrink-0">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.13a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.35a16 16 0 006.56 6.56l1.11-1.16a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            <a
              href="tel:+919767663123"
              className="text-[13px] sm:text-[15px] font-medium underline transition-colors hover:text-[#ed1a24]"
            >
              +91 97676-63123
            </a>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-center justify-between gap-4 border-t border-white/20 pt-6 md:flex-row">
          <p className="text-[12px] sm:text-[15px] font-medium leading-[1.6] text-white">
            © 2023 Merito - by Career Corner Education Pvt. Ltd
          </p>
          <div className="hidden sm:flex items-center gap-[10px]">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="text-white transition-opacity hover:opacity-70"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
