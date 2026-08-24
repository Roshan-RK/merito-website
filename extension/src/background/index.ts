import { lookupCandidate } from "../lib/lookupApi";
import { rescoreCandidate } from "../lib/rescoreApi";
import { scoreProspect, getProspectScoreStatus } from "../lib/scoreProspectApi";
import { requestVerificationEmail, checkVerificationStatus } from "../lib/verifyEmailApi";
import { shortlistProspect } from "../lib/shortlistApi";
import { requestContactDetails } from "../lib/requestContactDetailsApi";
import { extractJdTextFromFile } from "../lib/extractJdTextApi";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOOKUP_CANDIDATE" && typeof message.linkedinUrl === "string") {
    const recruiterEmail = typeof message.recruiterEmail === "string" ? message.recruiterEmail : "";
    lookupCandidate(message.linkedinUrl, recruiterEmail).then(sendResponse);
    return true;
  }
  if (
    message?.type === "RESCORE_CANDIDATE" &&
    typeof message.linkedinUrl === "string" &&
    typeof message.jdText === "string"
  ) {
    const recruiterEmail = typeof message.recruiterEmail === "string" ? message.recruiterEmail : "";
    rescoreCandidate(message.linkedinUrl, message.jdText, recruiterEmail).then(sendResponse);
    return true;
  }
  if (message?.type === "SCORE_PROSPECT" && typeof message.input === "object") {
    scoreProspect(message.input).then(sendResponse);
    return true;
  }
  if (message?.type === "CHECK_PROSPECT_STATUS" && typeof message.prospectId === "string") {
    const recruiterEmail = typeof message.recruiterEmail === "string" ? message.recruiterEmail : "";
    getProspectScoreStatus(message.prospectId, recruiterEmail).then(sendResponse);
    return true;
  }
  if (
    message?.type === "VERIFY_RECRUITER_EMAIL" &&
    typeof message.email === "string" &&
    typeof message.company === "string"
  ) {
    requestVerificationEmail(message.email, message.company).then(sendResponse);
    return true;
  }
  if (message?.type === "CHECK_RECRUITER_VERIFIED" && typeof message.email === "string") {
    checkVerificationStatus(message.email).then(sendResponse);
    return true;
  }
  if (message?.type === "OPEN_POPUP") {
    if (typeof chrome.action.openPopup !== "function") {
      sendResponse(false);
      return false;
    }
    chrome.action
      .openPopup()
      .then(() => sendResponse(true))
      .catch(() => sendResponse(false));
    return true;
  }
  if (message?.type === "SHORTLIST_PROSPECT" && typeof message.prospectId === "string") {
    const recruiterEmail = typeof message.recruiterEmail === "string" ? message.recruiterEmail : "";
    shortlistProspect(message.prospectId, recruiterEmail).then(sendResponse);
    return true;
  }
  if (message?.type === "REQUEST_CONTACT_DETAILS" && typeof message.linkedinUrl === "string") {
    const recruiterEmail = typeof message.recruiterEmail === "string" ? message.recruiterEmail : "";
    requestContactDetails(message.linkedinUrl, recruiterEmail).then(sendResponse);
    return true;
  }
  if (message?.type === "EXTRACT_JD_FILE" && message.file instanceof File) {
    extractJdTextFromFile(message.file).then(sendResponse);
    return true;
  }
  return false;
});
