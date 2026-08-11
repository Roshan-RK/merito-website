import { lookupCandidate } from "../lib/lookupApi";
import { rescoreCandidate } from "../lib/rescoreApi";
import { scoreProspect } from "../lib/scoreProspectApi";
import { requestVerificationEmail } from "../lib/verifyEmailApi";
import { shortlistProspect } from "../lib/shortlistApi";
import { requestContactDetails } from "../lib/requestContactDetailsApi";
import { extractJdTextFromFile } from "../lib/extractJdTextApi";

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
  if (message?.type === "SCORE_PROSPECT" && typeof message.input === "object") {
    scoreProspect(message.input).then(sendResponse);
    return true;
  }
  if (message?.type === "VERIFY_RECRUITER_EMAIL" && typeof message.email === "string") {
    requestVerificationEmail(message.email).then(sendResponse);
    return true;
  }
  if (message?.type === "SHORTLIST_PROSPECT" && typeof message.prospectId === "string") {
    shortlistProspect(message.prospectId).then(sendResponse);
    return true;
  }
  if (message?.type === "REQUEST_CONTACT_DETAILS" && typeof message.linkedinUrl === "string") {
    requestContactDetails(message.linkedinUrl).then(sendResponse);
    return true;
  }
  if (message?.type === "EXTRACT_JD_FILE" && message.file instanceof File) {
    extractJdTextFromFile(message.file).then(sendResponse);
    return true;
  }
  return false;
});
