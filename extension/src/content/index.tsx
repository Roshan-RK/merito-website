import { createRoot, type Root } from "react-dom/client";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "./linkedinUrl";
import { Overlay, type RescoreState } from "../overlay/Overlay";
import type { LookupResponse, RescoreResponse } from "../../../shared/recruiter-preview/types";

const JD_STORAGE_KEY = "meritoJdText";

let currentUrl = "";
let shadowHost: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
let currentLookup: LookupResponse | null = null;

function unmountOverlay() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
  }
  currentLookup = null;
}

function renderOverlay(data: LookupResponse, rescore: RescoreState) {
  if (!shadowHost) {
    shadowHost = document.createElement("div");
    shadowHost.id = "merito-recruiter-preview-root";
    document.body.appendChild(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);
    reactRoot = createRoot(mountPoint);
  }
  reactRoot?.render(<Overlay data={data} rescore={rescore} />);
}

async function runRescoreIfJdSet(linkedinUrl: string) {
  const stored = await chrome.storage.local.get([JD_STORAGE_KEY]);
  const jdText = stored[JD_STORAGE_KEY] as string | undefined;
  if (!jdText || !currentLookup) return;

  renderOverlay(currentLookup, { status: "loading" });
  const result = (await chrome.runtime.sendMessage({
    type: "RESCORE_CANDIDATE",
    linkedinUrl,
    jdText,
  })) as RescoreResponse | null;

  if (!currentLookup || linkedinUrl !== currentUrl) return;
  if (result?.fitment) {
    renderOverlay(currentLookup, { status: "ready", fitment: result.fitment });
  } else {
    renderOverlay(currentLookup, { status: "idle" });
  }
}

async function handleUrlChange() {
  const normalized = normalizeLinkedinUrl(window.location.href);
  if (normalized === currentUrl) return;
  currentUrl = normalized;
  unmountOverlay();

  if (!LINKEDIN_URL_PATTERN.test(normalized)) return;

  const result = (await chrome.runtime.sendMessage({
    type: "LOOKUP_CANDIDATE",
    linkedinUrl: normalized,
  })) as LookupResponse | null;
  if (!result) return;

  currentLookup = result;
  renderOverlay(result, { status: "idle" });
  runRescoreIfJdSet(normalized);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && JD_STORAGE_KEY in changes && currentLookup) {
    runRescoreIfJdSet(currentUrl);
  }
});

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
