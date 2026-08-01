import { createRoot, type Root } from "react-dom/client";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "./linkedinUrl";
import { lookupCandidate } from "../lib/lookupApi";
import { Overlay } from "../overlay/Overlay";
import type { LookupResponse } from "../overlay/types";

let currentUrl = "";
let shadowHost: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

function unmountOverlay() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
  }
}

function mountOverlay(data: LookupResponse) {
  unmountOverlay();
  shadowHost = document.createElement("div");
  shadowHost.id = "merito-recruiter-preview-root";
  document.body.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);
  reactRoot = createRoot(mountPoint);
  reactRoot.render(<Overlay data={data} />);
}

async function handleUrlChange() {
  const url = window.location.href;
  if (url === currentUrl) return;
  currentUrl = url;
  unmountOverlay();

  const normalized = normalizeLinkedinUrl(url);
  if (!LINKEDIN_URL_PATTERN.test(normalized)) return;

  const result = await lookupCandidate(normalized);
  if (result) mountOverlay(result);
}

function watchUrlChanges() {
  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    handleUrlChange();
  }) as typeof history.pushState;
  window.addEventListener("popstate", handleUrlChange);
}

watchUrlChanges();
handleUrlChange();
