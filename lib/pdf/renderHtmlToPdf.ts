/**
 * Renders a standalone HTML string to a PDF buffer via headless Chromium.
 * Used for synthetic resumes built from scraped LinkedIn data, where there's
 * no live authenticated app page to point a browser at (contrast with
 * renderPageToPdf, which screenshots a real app URL).
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const isProd = Boolean(process.env.VERCEL_ENV);

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
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
