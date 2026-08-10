import { lookupCandidate } from "../lib/lookupApi";
import { rescoreCandidate } from "../lib/rescoreApi";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOOKUP_CANDIDATE" && typeof message.linkedinUrl === "string") {
    lookupCandidate(message.linkedinUrl).then(sendResponse);
    return true;
  }
  if (
    message?.type === "RESCORE_CANDIDATE" &&
    typeof message.linkedinUrl === "string" &&
    typeof message.jdText === "string"
  ) {
    rescoreCandidate(message.linkedinUrl, message.jdText).then(sendResponse);
    return true;
  }
  return false;
});
