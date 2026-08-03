import { lookupCandidate } from "../lib/lookupApi";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOOKUP_CANDIDATE" && typeof message.linkedinUrl === "string") {
    lookupCandidate(message.linkedinUrl).then(sendResponse);
    return true;
  }
  return false;
});
