export type PageCookie = { name: string; value: string; domain: string };

/**
 * Parses the raw `Cookie` header off the incoming Route Handler request
 * (rather than next/headers' `cookies()`) so this works the same inside
 * Vitest's plain Request objects as it does in a real Next.js request —
 * `cookies()` depends on Next's AsyncLocalStorage request scope, which
 * doesn't exist in unit tests.
 */
export function requestCookiesFor(request: Request, domain: string): PageCookie[] {
  const header = request.headers.get("cookie");
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain };
    });
}

/**
 * Renders a live app page to a PDF buffer via headless Chromium, as the
 * authenticated user (cookies forwarded from the incoming request). Used to
 * make downloaded reports pixel-identical to their on-screen page instead of
 * hand-recreating each layout in a separate PDF styling system.
 *
 * `singlePage: true` sizes the PDF to the page's actual rendered height
 * instead of paginating into A4 sheets — for designs (like combined-report)
 * built as one continuous scroll with no print pagination in mind, A4
 * pagination cuts sections mid-block and breaks background color continuity
 * at every page seam.
 */
export async function renderPageToPdf(
  url: string,
  cookies: PageCookie[],
  options: { singlePage?: boolean } = {}
): Promise<Buffer> {
  const isProd = Boolean(process.env.VERCEL_ENV);

  // @sparticuz/chromium only ships a Linux binary (Vercel/Lambda target) — it
  // can't launch on a non-Linux dev machine, so dev uses the full `puppeteer`
  // package instead, which bundles a Chromium build for the local OS.
  const browser = isProd
    ? await (async () => {
        const { default: puppeteer } = await import("puppeteer-core");
        const { default: chromium } = await import("@sparticuz/chromium");
        return puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        });
      })()
    : await (async () => {
        const { default: puppeteer } = await import("puppeteer");
        return puppeteer.launch({ headless: true });
      })();

  try {
    const page = await browser.newPage();
    await page.setCookie(...cookies.map((cookie) => ({ ...cookie, path: "/" })));
    if (options.singlePage) {
      await page.setViewport({ width: 900, height: 1200 });
    }
    await page.goto(url, { waitUntil: "networkidle0" });

    let pdf: Uint8Array;
    if (options.singlePage) {
      const heightPx = await page.evaluate(() => document.documentElement.scrollHeight);
      pdf = await page.pdf({
        width: "900px",
        height: `${heightPx}px`,
        printBackground: true,
        pageRanges: "1",
      });
    } else {
      pdf = await page.pdf({ format: "A4", printBackground: true });
    }
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
