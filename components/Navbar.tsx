"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isHubAccountRoute } from "@/lib/hubRoutes";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import type { Session } from "@supabase/supabase-js";

const navLinks = [
  { label: "About us", href: "/about" },
  { label: "Merito's way", href: "/meritoways" },
  { label: "Platform & tools", href: "#tools" },
  { label: "HUB", href: "/hub" },
  { label: "Insights", href: "/insights" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(
      ({ data }) => setSession(data.session),
      () => setSession(null)
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlatformsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (isHubAccountRoute(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex justify-center bg-transparent px-4 py-4">
      <nav className="flex h-[82px] w-full max-w-[1328px] items-center justify-between rounded-[40px] border border-black/12 bg-white px-4 shadow-[0_8px_22px_rgba(17,35,89,0.08)] sm:rounded-[8px] sm:px-5 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Merito"
            width={121}
            height={60}
            className="h-[60px] w-auto object-contain"
            priority
            unoptimized
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-3 md:flex lg:gap-5">
          {navLinks.map((link) => {
            if (link.label === "Platform & tools") {
              return (
                <div key={link.href} className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setPlatformsOpen(!platformsOpen)}
                    className="whitespace-nowrap px-[9px] py-[10px] font-[family-name:var(--font-gabarito)] text-[17px] font-medium text-black transition-colors hover:text-[#ed1a24] focus:outline-none flex items-center gap-1"
                  >
                    {link.label}
                    <svg className={`w-4 h-4 transition-transform ${platformsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {/* Dropdown */}
                  {platformsOpen && (
                    <div className="absolute top-[60px] left-1/2 -translate-x-1/2 w-[380px] bg-[#FDFDFD] shadow-[5px_5px_4px_rgba(0,0,0,0.25)] rounded-[7px] border border-black/5 p-5 flex flex-col gap-4 z-50">
                      {/* Triangle Pointer */}
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#FDFDFD] rotate-45 border-l border-t border-black/5 shadow-[-2px_-2px_2px_rgba(0,0,0,0.02)]" />

                      {/* — Platform section — */}
                      <div className="relative z-10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9c9c9c] mb-2 px-1">Platform</p>
                        {/* RAMP */}
                        <Link href="/ramp" onClick={() => setPlatformsOpen(false)} className="flex items-center gap-4 p-3 rounded-[4px] bg-[rgba(236,34,40,0.01)] shadow-[0px_0px_10px_1px_rgba(236,34,40,0.25)] hover:bg-[#ED1A24]/5 transition-colors group">
                          <div className="w-[32px] h-[32px] bg-[#ED1A24] rounded-[6px] flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="3" y="3" width="5" height="18" rx="1" fill="white" opacity="0.9"/>
                              <rect x="10" y="7" width="5" height="14" rx="1" fill="white" opacity="0.75"/>
                              <rect x="17" y="11" width="4" height="10" rx="1" fill="white" opacity="0.6"/>
                            </svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-black font-[family-name:var(--font-poppins)] font-semibold text-[14px] group-hover:text-[#ED1A24] transition-colors leading-none">RAMP</span>
                            <span className="text-[#4B4B4D] font-medium text-[11px] leading-[15px] mt-1">Recruitment activity management<br/>platform for in-house TA teams</span>
                          </div>
                          <div className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                            <svg width="24" height="24" viewBox="0 0 48 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M43.625 10.5H31.375M43.625 10.5L40.125 14M43.625 10.5L40.125 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-black/6" />

                      {/* — Tools section — */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9c9c9c] mb-2 px-1">Tools</p>
                        <div className="flex flex-col gap-3">
                          {/* Reftrack */}
                          <Link href="/reftrack" onClick={() => setPlatformsOpen(false)} className="flex items-center gap-4 p-3 rounded-[4px] bg-[rgba(236,34,40,0.01)] shadow-[0px_0px_10px_1px_rgba(236,34,40,0.25)] hover:bg-[#ED1A24]/5 transition-colors group">
                            <div className="text-[#ED1A24]">
                              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 6C0 2.68629 2.68629 0 6 0H26C29.3137 0 32 2.68629 32 6V26C32 29.3137 29.3137 32 26 32H6C2.68629 32 0 29.3137 0 26V6Z" fill="#ED1A24"/>
                                <path d="M20.806 20.898C21.27 20.4323 21.502 19.862 21.502 19.1871C21.502 18.5123 21.2689 17.9431 20.8026 17.4797C20.3363 17.0163 19.766 16.7843 19.0917 16.7837C18.4174 16.7831 17.8483 17.0163 17.3843 17.4831C16.9203 17.95 16.6883 18.5203 16.6883 19.194C16.6883 19.8677 16.9214 20.4369 17.3877 20.9014C17.854 21.366 18.4243 21.598 19.0986 21.5974C19.7729 21.5969 20.342 21.3637 20.806 20.898ZM23.4674 23.9854C23.3451 23.9854 23.2437 23.9454 23.1631 23.8654L21.0863 21.7723C20.808 21.994 20.4994 22.1631 20.1606 22.2797C19.8217 22.3963 19.4666 22.4546 19.0951 22.4546C18.1889 22.4546 17.4183 22.1371 16.7834 21.5023C16.1486 20.8674 15.8314 20.0969 15.832 19.1906C15.8326 18.2843 16.1497 17.5137 16.7834 16.8789C17.4171 16.244 18.1877 15.9269 19.0951 15.9274C20.0026 15.928 20.7731 16.2451 21.4069 16.8789C22.0406 17.5126 22.3577 18.2831 22.3583 19.1906C22.3583 19.562 22.3003 19.9171 22.1843 20.256C22.0683 20.5949 21.8989 20.9034 21.676 21.1817L23.77 23.2586C23.85 23.338 23.89 23.4389 23.89 23.5611C23.89 23.684 23.8503 23.7854 23.7709 23.8654C23.6914 23.9454 23.5903 23.9854 23.4674 23.9854ZM9.766 23.0477C9.37115 23.0477 9.04172 22.9157 8.77772 22.6517C8.51372 22.3877 8.38143 22.0583 8.38086 21.6634V9.00343C8.38086 8.60914 8.51314 8.28 8.77772 8.016C9.04229 7.752 9.37172 7.61971 9.766 7.61914H15.9486C16.1377 7.61914 16.3183 7.65628 16.4903 7.73057C16.6623 7.80486 16.8103 7.90457 16.9343 8.02971L19.9694 11.0649C20.0934 11.1894 20.1929 11.3374 20.2677 11.5089C20.3426 11.6803 20.38 11.8609 20.38 12.0506V13.2771C20.38 13.4794 20.304 13.648 20.152 13.7829C19.9994 13.9183 19.8166 13.9669 19.6034 13.9286L19.3497 13.8977C19.2674 13.8874 19.1823 13.8823 19.0943 13.8823C18.272 13.8823 17.512 14.0514 16.8143 14.3897C16.1154 14.728 15.5191 15.1851 15.0254 15.7611H11.8094C11.6877 15.7611 11.586 15.8023 11.5043 15.8846C11.4226 15.9669 11.3814 16.0689 11.3809 16.1906C11.3803 16.3123 11.4214 16.414 11.5043 16.4957C11.5871 16.5774 11.6889 16.6186 11.8094 16.6191H14.4631C14.2391 17.0117 14.0703 17.4249 13.9566 17.8586C13.8423 18.2929 13.7874 18.7369 13.792 19.1906H11.8094C11.6877 19.1906 11.586 19.2317 11.5043 19.314C11.4226 19.3963 11.3814 19.4983 11.3809 19.62C11.3803 19.7417 11.4214 19.8434 11.5043 19.9251C11.5871 20.0069 11.6889 20.0477 11.8094 20.0477H13.8554C13.9223 20.4357 14.0254 20.8069 14.1649 21.1611C14.3043 21.5154 14.484 21.8514 14.704 22.1691C14.8383 22.3617 14.8606 22.556 14.7709 22.752C14.6811 22.9491 14.5286 23.0477 14.3131 23.0477H9.766ZM16.0951 8.47628V11.2191C16.0951 11.4134 16.1609 11.5763 16.2923 11.7077C16.4237 11.8391 16.5866 11.9049 16.7809 11.9049H19.5237L16.0951 8.47628Z" fill="white"/>
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-black font-[family-name:var(--font-poppins)] font-semibold text-[14px] group-hover:text-[#ED1A24] transition-colors leading-none">Reftrack</span>
                              <span className="text-[#4B4B4D] font-medium text-[11px] leading-[15px] mt-1">Make well-informed hiring<br/>decisions without our reference platform</span>
                            </div>
                            <div className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                              <svg width="24" height="24" viewBox="0 0 48 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M43.625 10.5H31.375M43.625 10.5L40.125 14M43.625 10.5L40.125 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </Link>

                          {/* OfferVault */}
                          <Link href="/offervault" onClick={() => setPlatformsOpen(false)} className="flex items-center gap-4 p-3 rounded-[4px] bg-[rgba(236,34,40,0.01)] shadow-[0px_0px_10px_1px_rgba(236,34,40,0.25)] hover:bg-[#ED1A24]/5 transition-colors group">
                            <div className="w-[32px] h-[32px] bg-[#ED1A24] rounded-[6px] flex items-center justify-center">
                              <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.7855 10.2857L18.7317 8.6503C18.8455 8.45354 18.8764 8.21966 18.8177 8.0001C18.7591 7.78053 18.6156 7.59325 18.4189 7.47944L16.7817 6.53316V4.64744C16.7817 4.42011 16.6914 4.2021 16.5307 4.04135C16.3699 3.88061 16.1519 3.7903 15.9246 3.7903H14.0397L13.0943 2.15401C12.9807 1.95716 12.7936 1.81348 12.574 1.75459C12.4653 1.72544 12.3518 1.71801 12.2402 1.73272C12.1286 1.74743 12.021 1.78398 11.9235 1.8403L10.2863 2.78659L8.64917 1.83944C8.4523 1.72578 8.21835 1.69498 7.99877 1.75382C7.77919 1.81265 7.59198 1.95629 7.47831 2.15316L6.53203 3.7903H4.64717C4.41984 3.7903 4.20182 3.88061 4.04108 4.04135C3.88033 4.2021 3.79003 4.42011 3.79003 4.64744V6.5323L2.15288 7.47859C2.05537 7.53494 1.96991 7.60996 1.9014 7.69936C1.83289 7.78876 1.78268 7.89079 1.75362 7.9996C1.72457 8.10842 1.71724 8.2219 1.73207 8.33355C1.74689 8.4452 1.78358 8.55284 1.84003 8.6503L2.78631 10.2857L1.84003 11.9212C1.72687 12.1181 1.69617 12.3518 1.75462 12.5713C1.81307 12.7908 1.95592 12.9783 2.15203 13.0929L3.78917 14.0392V15.924C3.78917 16.1513 3.87948 16.3694 4.04022 16.5301C4.20097 16.6909 4.41898 16.7812 4.64631 16.7812H6.53203L7.47831 18.4183C7.5542 18.548 7.66254 18.6558 7.79269 18.7309C7.92284 18.806 8.07032 18.846 8.2206 18.8469C8.36974 18.8469 8.51803 18.8074 8.65003 18.7312L10.2855 17.7849L11.9226 18.7312C12.1194 18.8449 12.3532 18.8758 12.5728 18.8172C12.7924 18.7585 12.9796 18.615 13.0935 18.4183L14.0389 16.7812H15.9237C16.1511 16.7812 16.3691 16.6909 16.5298 16.5301C16.6906 16.3694 16.7809 16.1513 16.7809 15.924V14.0392L18.418 13.0929C18.5155 13.0365 18.601 12.9615 18.6695 12.8721C18.738 12.7827 18.7882 12.6807 18.8173 12.5719C18.8463 12.463 18.8537 12.3496 18.8388 12.2379C18.824 12.1263 18.7873 12.0186 18.7309 11.9212L17.7855 10.2857ZM8.1426 5.99144C8.4837 5.99156 8.8108 6.12717 9.05191 6.36845C9.29303 6.60973 9.42843 6.93691 9.42831 7.27801C9.4282 7.61912 9.29259 7.94621 9.05131 8.18733C8.81003 8.42845 8.48285 8.56384 8.14174 8.56373C7.80064 8.56362 7.47355 8.428 7.23243 8.18672C6.99131 7.94544 6.85591 7.61826 6.85603 7.27716C6.85614 6.93605 6.99175 6.60896 7.23303 6.36784C7.47431 6.12672 7.80149 5.99133 8.1426 5.99144ZM8.39974 14.22L7.02831 13.1923L12.1712 6.33516L13.5426 7.36287L8.39974 14.22ZM12.4283 14.5629C12.2594 14.5628 12.0922 14.5295 11.9362 14.4648C11.7801 14.4001 11.6384 14.3053 11.519 14.1859C11.3996 14.0664 11.3049 13.9246 11.2403 13.7685C11.1758 13.6125 11.1425 13.4452 11.1426 13.2763C11.1427 13.1074 11.176 12.9402 11.2407 12.7841C11.3054 12.6281 11.3054 12.6281 11.3054 12.6281C11.3054 12.6281 11.4001 12.4864 11.5196 12.367C11.6391 12.2476 11.7809 12.1529 11.937 12.0883C12.093 12.0237 12.2603 11.9905 12.4292 11.9906C12.7703 11.9907 13.0974 12.1263 13.3385 12.3676C13.5796 12.6089 13.715 12.9361 13.7149 13.2772C13.7148 13.6183 13.5792 13.9454 13.3379 14.1865C13.0966 14.4276 12.7694 14.563 12.4283 14.5629Z" fill="white"/>
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-black font-[family-name:var(--font-poppins)] font-semibold text-[14px] group-hover:text-[#ED1A24] transition-colors leading-none">OfferVault</span>
                              <span className="text-[#4B4B4D] font-medium text-[11px] leading-[15px] mt-1">Overcome after dropouts<br/>with our online offer platform</span>
                            </div>
                            <div className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                              <svg width="24" height="24" viewBox="0 0 48 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M43.625 10.5H31.375M43.625 10.5L40.125 14M43.625 10.5L40.125 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap px-[9px] py-[10px] font-[family-name:var(--font-gabarito)] text-[17px] font-medium text-black transition-colors hover:text-[#ed1a24]"
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {session === null && (
          <Link
            href="/hub/login"
            className="hidden whitespace-nowrap px-[9px] py-[10px] font-[family-name:var(--font-gabarito)] text-[17px] font-medium text-black transition-colors hover:text-[#ed1a24] md:block"
          >
            Log in
          </Link>
        )}

        {/* CTA */}
        <Link
          href="/contact"
          className="relative hidden h-[50px] items-center justify-center overflow-hidden whitespace-nowrap rounded-[8px] bg-[#ed1a24] px-6 font-[family-name:var(--font-poppins)] text-[16px] font-semibold text-white transition-all duration-200 hover:bg-black hover:text-white hover:scale-[1.03] active:scale-[0.97] md:flex"
        >
          <span className="relative z-10">Talk to an expert</span>
        </Link>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <div className="w-6 h-0.5 bg-black mb-1.5" />
          <div className="w-6 h-0.5 bg-black mb-1.5" />
          <div className="w-6 h-0.5 bg-black" />
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="absolute left-4 right-4 top-[104px] flex flex-col gap-4 rounded-[12px] border border-black/10 bg-white p-6 shadow-[0_14px_34px_rgba(17,35,89,0.12)] md:hidden">
          {navLinks.map((link) => {
            if (link.label === "Platform & tools") {
              return (
                <div key={link.href} className="flex flex-col gap-3">
                  <p className="font-[family-name:var(--font-gabarito)] font-medium text-[18px] text-black">
                    {link.label}
                  </p>
                  {/* Platform sub-section */}
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9c9c9c] pl-4">Platform</p>
                    <div className="flex flex-col gap-2 pl-4 border-l-2 border-[#ed1a24]/20">
                      <Link href="/ramp" onClick={() => setOpen(false)} className="text-[#4B4B4D] font-medium text-[16px] hover:text-[#ed1a24] transition-colors">RAMP</Link>
                    </div>
                  </div>
                  {/* Tools sub-section */}
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9c9c9c] pl-4">Tools</p>
                    <div className="flex flex-col gap-2 pl-4 border-l-2 border-[#ed1a24]/20">
                      <Link href="/reftrack" onClick={() => setOpen(false)} className="text-[#4B4B4D] font-medium text-[16px] hover:text-[#ed1a24] transition-colors">Reftrack</Link>
                      <Link href="/offervault" onClick={() => setOpen(false)} className="text-[#4B4B4D] font-medium text-[16px] hover:text-[#ed1a24] transition-colors">OfferVault</Link>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-[family-name:var(--font-gabarito)] font-medium text-[18px] text-black hover:text-[#ed1a24] transition-colors"
              >
                {link.label}
              </Link>
            );
          })}
          {session === null && (
            <Link
              href="/hub/login"
              onClick={() => setOpen(false)}
              className="font-[family-name:var(--font-gabarito)] font-medium text-[18px] text-black hover:text-[#ed1a24] transition-colors"
            >
              Log in
            </Link>
          )}
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center bg-[#ed1a24] text-white font-semibold text-[16px] px-6 h-[50px] rounded-[8px] mt-2"
          >
            Talk to an expert
          </Link>
        </div>
      )}
    </header>
  );
}
