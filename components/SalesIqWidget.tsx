"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export default function SalesIqWidget() {
  const pathname = usePathname();
  if (pathname?.startsWith("/hub")) return null;

  return (
    <>
      <Script id="zoho-init" strategy="afterInteractive">
        {`
          window.$zoho=window.$zoho || {};
          $zoho.salesiq=$zoho.salesiq||{ready:function(){}}
        `}
      </Script>
      <Script
        id="zsiqscript"
        src="https://salesiq.zohopublic.in/widget?wc=siq60bd6a01da5298e0b5a2257627058c32ba59a589f85784499b5013bfa2af42fc"
        strategy="afterInteractive"
      />
    </>
  );
}
