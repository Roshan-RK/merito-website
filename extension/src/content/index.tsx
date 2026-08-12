import { createRoot, type Root } from "react-dom/client";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "./linkedinUrl";
import { Overlay, type RescoreState } from "../overlay/Overlay";
import { ProspectOverlay } from "../overlay/ProspectOverlay";
import { scrapeProfile } from "../lib/scrapeProfile";
import type { LookupResponse, RescoreResponse, ScoreProspectResponse } from "../../../shared/recruiter-preview/types";

const JD_STORAGE_KEY = "meritoJdText";
const EMAIL_STORAGE_KEY = "meritoRecruiterEmail";
const LEVEL_STORAGE_KEY = "meritoCandidateLevel";

let currentUrl = "";
let shadowHost: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
let currentLookup: LookupResponse | null = null;

function mountRoot(): Root {
  if (!shadowHost) {
    shadowHost = document.createElement("div");
    shadowHost.id = "merito-recruiter-preview-root";
    document.body.appendChild(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);
    reactRoot = createRoot(mountPoint);
  }
  return reactRoot!;
}

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
  mountRoot().render(<Overlay data={data} rescore={rescore} onRequestContactDetails={requestContactDetails} />);
}

async function requestContactDetails(): Promise<{ email: string } | { error: string } | null> {
  return (await chrome.runtime.sendMessage({ type: "REQUEST_CONTACT_DETAILS", linkedinUrl: currentUrl })) as
    | { email: string }
    | { error: string }
    | null;
}

async function runProspectFlow(linkedinUrl: string) {
  const stored = await chrome.storage.local.get([JD_STORAGE_KEY, EMAIL_STORAGE_KEY, LEVEL_STORAGE_KEY]);
  const jdText = stored[JD_STORAGE_KEY] as string | undefined;
  const recruiterEmail = stored[EMAIL_STORAGE_KEY] as string | undefined;
  const candidateLevel = (stored[LEVEL_STORAGE_KEY] as "entry" | "mid" | "senior" | undefined) ?? "mid";

  if (!jdText || !recruiterEmail) {
    mountRoot().render(<ProspectOverlay state={{ status: "needs_setup" }} onScore={() => runProspectFlow(linkedinUrl)} onShortlist={() => {}} />);
    return;
  }

  // Recruiter explicitly opts in per-profile — scoring a prospect spends one
  // of their monthly slots, so it must never fire silently on every visit.
  mountRoot().render(
    <ProspectOverlay
      state={{ status: "prompt" }}
      onScore={() => scoreProspectNow(linkedinUrl, jdText, recruiterEmail, candidateLevel)}
      onShortlist={() => {}}
    />
  );
}

const PROSPECT_POLL_INTERVAL_MS = 5_000;
const PROSPECT_POLL_MAX_ATTEMPTS = 36; // ~3 minutes at 5s intervals

function renderProspectReady(fitment: NonNullable<ScoreProspectResponse["fitment"]>, prospectId: string) {
  mountRoot().render(
    <ProspectOverlay
      state={{ status: "ready", fitment, prospectId }}
      onScore={() => {}}
      onShortlist={async () => {
        const shortlistResult = (await chrome.runtime.sendMessage({ type: "SHORTLIST_PROSPECT", prospectId })) as {
          claimUrl: string;
          inviteText: string;
        } | null;
        if (shortlistResult) {
          mountRoot().render(
            <ProspectOverlay state={{ status: "shortlisted", fitment, prospectId, ...shortlistResult }} onScore={() => {}} onShortlist={() => {}} />
          );
        }
      }}
    />
  );
}

async function pollProspectStatus(linkedinUrl: string, prospectId: string, retry: () => void, attempt = 1) {
  if (linkedinUrl !== currentUrl) return; // navigated away — scoring keeps running server-side, cache picks it up on return

  let result: { status: string; data?: ScoreProspectResponse };
  try {
    result = (await chrome.runtime.sendMessage({ type: "CHECK_PROSPECT_STATUS", prospectId })) as {
      status: string;
      data?: ScoreProspectResponse;
    };
  } catch {
    if (linkedinUrl !== currentUrl) return;
    mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }

  if (linkedinUrl !== currentUrl) return;

  if (result.status === "ready" && result.data?.fitment) {
    renderProspectReady(result.data.fitment, result.data.prospectId);
    return;
  }
  if (result.status !== "pending") {
    mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }
  if (attempt >= PROSPECT_POLL_MAX_ATTEMPTS) {
    mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }

  setTimeout(() => pollProspectStatus(linkedinUrl, prospectId, retry, attempt + 1), PROSPECT_POLL_INTERVAL_MS);
}

async function scoreProspectNow(
  linkedinUrl: string,
  jdText: string,
  recruiterEmail: string,
  candidateLevel: "entry" | "mid" | "senior"
) {
  mountRoot().render(<ProspectOverlay state={{ status: "loading" }} onScore={() => {}} onShortlist={() => {}} />);

  const candidateFields = scrapeProfile();
  console.log("[Merito] scraped candidate fields:", candidateFields);
  const retry = () => scoreProspectNow(linkedinUrl, jdText, recruiterEmail, candidateLevel);

  let result: { status: string; data?: ScoreProspectResponse; prospectId?: string };
  try {
    result = (await chrome.runtime.sendMessage({
      type: "SCORE_PROSPECT",
      input: { recruiterEmail, linkedinUrl, jdText, candidateLevel, candidateFields },
    })) as { status: string; data?: ScoreProspectResponse; prospectId?: string };
  } catch {
    // Extension was reloaded/updated while this tab stayed open — the old
    // content script's runtime connection is dead. Only a page refresh fixes it.
    if (linkedinUrl !== currentUrl) return;
    mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }

  if (linkedinUrl !== currentUrl) return;

  if (result.status === "verification_required") {
    mountRoot().render(<ProspectOverlay state={{ status: "verification_required" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }
  if (result.status === "cap_exceeded") {
    mountRoot().render(<ProspectOverlay state={{ status: "cap_exceeded" }} onScore={() => {}} onShortlist={() => {}} />);
    return;
  }
  if (result.status === "ready" && result.data?.fitment) {
    renderProspectReady(result.data.fitment, result.data.prospectId);
    return;
  }
  if (result.status === "pending" && result.prospectId) {
    mountRoot().render(<ProspectOverlay state={{ status: "scoring" }} onScore={() => {}} onShortlist={() => {}} />);
    pollProspectStatus(linkedinUrl, result.prospectId, retry);
    return;
  }

  mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
}

async function runRescoreIfJdSet(linkedinUrl: string) {
  const stored = await chrome.storage.local.get([JD_STORAGE_KEY]);
  const jdText = stored[JD_STORAGE_KEY] as string | undefined;
  if (!jdText || !currentLookup) return;

  renderOverlay(currentLookup, { status: "loading" });
  let result: RescoreResponse | null;
  try {
    result = (await chrome.runtime.sendMessage({
      type: "RESCORE_CANDIDATE",
      linkedinUrl,
      jdText,
    })) as RescoreResponse | null;
  } catch {
    if (!currentLookup || linkedinUrl !== currentUrl) return;
    renderOverlay(currentLookup, { status: "idle" });
    return;
  }

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

  let result: LookupResponse | null;
  try {
    result = (await chrome.runtime.sendMessage({
      type: "LOOKUP_CANDIDATE",
      linkedinUrl: normalized,
    })) as LookupResponse | null;
  } catch {
    // Stale/reloaded extension context, or a transient network failure —
    // surface it instead of leaving the page with no overlay at all.
    if (normalized !== currentUrl) return;
    const retry = () => {
      currentUrl = ""; // handleUrlChange no-ops if normalized === currentUrl, so clear it to force a re-fetch
      handleUrlChange();
    };
    mountRoot().render(<ProspectOverlay state={{ status: "error" }} onScore={retry} onShortlist={() => {}} />);
    return;
  }

  if (normalized !== currentUrl) return;

  if (!result) {
    runProspectFlow(normalized);
    return;
  }

  currentLookup = result;
  renderOverlay(result, { status: "idle" });
  runRescoreIfJdSet(normalized);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(JD_STORAGE_KEY in changes)) return;
  if (currentLookup) {
    runRescoreIfJdSet(currentUrl);
    return;
  }
  // Prospect (non-Merito) overlay isn't tied to currentLookup — reset it back
  // to the "check this candidate" prompt instead of leaving it stuck showing
  // a result (or error) scored against the JD that was just replaced.
  if (LINKEDIN_URL_PATTERN.test(currentUrl)) {
    runProspectFlow(currentUrl);
  }
});

function watchUrlChanges() {
  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    handleUrlChange();
  }) as typeof history.pushState;
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    handleUrlChange();
  }) as typeof history.replaceState;
  window.addEventListener("popstate", handleUrlChange);
  setInterval(() => {
    if (normalizeLinkedinUrl(window.location.href) !== currentUrl) handleUrlChange();
  }, 1000);
}

watchUrlChanges();
handleUrlChange();
