import { buildLookupFitment, buildLookupPersonality, buildLookupInterview } from '@/lib/recruiterPreview';
import type { ResumeMatchReportReady } from '@/lib/intervuebox/reports';
import type { InterviewReportReady } from '@/lib/intervuebox/interviewReports';

type Section = 'fitment' | 'personality' | 'interview';

export interface SectionResponse {
  fitment?: ReturnType<typeof buildLookupFitment>;
  personality?: ReturnType<typeof buildLookupPersonality>;
  interview?: ReturnType<typeof buildLookupInterview>;
}

export async function buildSectionResponse(
  lead: any,
  enabledSections: Section[]
): Promise<SectionResponse> {
  const result: SectionResponse = {};

  if (enabledSections.includes('fitment') && lead.resume_match_status === 'READY' && lead.resume_match_raw) {
    result.fitment = buildLookupFitment(lead.resume_match_raw as ResumeMatchReportReady, lead.role_title);
  }

  if (enabledSections.includes('personality')) {
    // Built in lookup route (query personality table)
  }

  if (enabledSections.includes('interview')) {
    // Built in lookup route (query interview table)
  }

  return result;
}
