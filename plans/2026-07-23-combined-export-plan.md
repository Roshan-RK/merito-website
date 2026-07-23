# Combined One-Pager PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick any combination of their 3 completed reports (fitment, personality, AI-interview) and download them as one combined PDF, triggered from a new modal on the dashboard.

**Architecture:** Extract each existing `*ReportPdf.tsx`'s inner content into a separately-exported `*PdfContent` component (pure refactor, zero behavior change to the 3 shipped single-report exports), then a new combined route stacks the requested content components into one `<Document>`. A new `CombinedExportModal.tsx` reuses `DashboardClient`'s already-fetched status flags — no new data-fetching on the dashboard.

**Tech Stack:** Same as the 3 shipped exports — `@react-pdf/renderer`, Next.js Route Handlers, Vitest.

## Global Constraints

- `InterviewStatus = "not_started" | "invited" | "ready"`, `PersonalityStatus = "not_started" | "ready"` (from `app/hub/account/ProgressRail.tsx` — verified, use these exact string literals, don't invent new ones).
- Colors/fonts: same tokens as the 3 shipped PDFs (`#ed1a24`, `#16803c`/`#eefdf1`, `#fdeced`, `#4b4b4d`, `#9c9c9c`, Helvetica/Helvetica-Bold).
- The modal must match `InterviewStartModal.tsx`'s exact visual structure (overlay div with `onClick={onClose}`, inner card with `onClick={(e) => e.stopPropagation()}`, close button styled identically, red pill badge, `font-[family-name:var(--font-gabarito)]`/`var(--font-poppins)` fonts) — don't invent a new modal chrome.
- Route tests follow the same chained-mock convention as the 3 existing export route tests (`app/api/hub/report/export/__tests__/route.test.ts` is the reference).
- No new tests for `*PdfContent` extraction or the modal component — matches this repo's convention (presentational components untested); the 3 existing route tests must still pass **unmodified** after the extraction, proving no behavior changed.
- Spec: `specs/2026-07-23-combined-export-design.md` — read first for full rationale.

---

### Task 1: Extract PDF content components + combined export route

**Files:**
- Modify: `app/api/hub/report/export/FitmentReportPdf.tsx`
- Modify: `app/api/hub/personality/export/PersonalityReportPdf.tsx`
- Modify: `app/api/hub/interview/export/InterviewReportPdf.tsx`
- Create: `app/api/hub/export/combined/route.tsx`
- Test: `app/api/hub/export/combined/__tests__/route.test.ts`

**Interfaces:**
- Consumes: existing `PdfPage`, `PdfSectionCard`, `PdfScoreBar` (`lib/pdf/`), `isReportUnlocked`, `getCandidateResumeDetails`, `ResumeMatchReportReady`, `InterviewReportReady`, `Scores`/`Validity`/`nameFromEmail` — all already used by the 3 existing routes, same import paths.
- Produces: `FitmentPdfContent`, `PersonalityPdfContent`, `InterviewPdfContent` (named exports, same props as their parent's current default-export props minus nothing — identical prop shape) — consumed by Task 1's own combined route only (no other task depends on this).

- [ ] **Step 1: Extract `FitmentPdfContent`**

Read `app/api/hub/report/export/FitmentReportPdf.tsx` in full first (already exists from the prior export plan). Change the file so the JSX currently inside `<PdfPage title="Fitment Report">...</PdfPage>` becomes a new named export `FitmentPdfContent` taking the exact same props, and the existing default export becomes a thin wrapper:

```tsx
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import PdfPage from "@/lib/pdf/PdfPage";
import PdfSectionCard from "@/lib/pdf/PdfSectionCard";
import PdfScoreBar from "@/lib/pdf/PdfScoreBar";
import pdfTheme from "@/lib/pdf/pdfTheme";
import type { ResumeMatchReportReady, CandidateResumeDetails } from "@/lib/intervuebox/reports";

const styles = StyleSheet.create({
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  subtitle: { fontFamily: "Helvetica", fontSize: 10, color: pdfTheme.colors.mutedText, marginBottom: 16 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: {
    backgroundColor: "#fdf8fb",
    borderWidth: 1,
    borderColor: pdfTheme.colors.border,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
    fontSize: 9,
  },
  sectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 4, marginBottom: 8 },
  point: { fontSize: 9.5, lineHeight: 1.6, marginBottom: 4 },
  profileRow: { flexDirection: "row", marginBottom: 8 },
  profileCol: { flex: 1 },
  profileTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  profileMeta: { fontSize: 8.5, color: pdfTheme.colors.mutedText, marginTop: 1 },
});

export type FitmentPdfContentProps = {
  displayName: string;
  roleTitle: string;
  formattedDate: string;
  score: number;
  report: ResumeMatchReportReady;
  candidateDetails: CandidateResumeDetails | null;
};

export function FitmentPdfContent({
  displayName,
  roleTitle,
  formattedDate,
  score,
  report,
  candidateDetails,
}: FitmentPdfContentProps) {
  return (
    <>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.subtitle}>
        {score.toFixed(1)} / 10 fit for {roleTitle} · {formattedDate}
      </Text>

      <PdfSectionCard label="Assessment summary">
        <Text>{report.summary}</Text>
      </PdfSectionCard>

      {candidateDetails && candidateDetails.skills.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.sectionHeading}>Skills</Text>
          <View style={styles.chipsRow}>
            {candidateDetails.skills.map((skill) => (
              <Text key={skill} style={styles.chip}>
                {skill}
              </Text>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionHeading}>Match breakdown</Text>
      {report.categories.map((category) => (
        <PdfScoreBar key={category.key} label={category.label} score={category.score} comment={category.comment} />
      ))}

      <Text style={styles.sectionHeading}>Strengths</Text>
      {report.strongPoints.map((point, i) => (
        <Text key={i} style={styles.point}>
          + {point}
        </Text>
      ))}

      <Text style={styles.sectionHeading}>Gaps to address</Text>
      {report.weakPoints.map((point, i) => (
        <Text key={i} style={styles.point}>
          - {point}
        </Text>
      ))}

      {candidateDetails && (candidateDetails.education.length > 0 || candidateDetails.experience.length > 0) && (
        <View>
          <Text style={styles.sectionHeading}>Candidate profile</Text>
          <View style={styles.profileRow}>
            {candidateDetails.education.length > 0 && (
              <View style={styles.profileCol}>
                <Text style={[styles.profileTitle, { marginBottom: 4 }]}>Education</Text>
                {candidateDetails.education.map((e, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <Text style={styles.profileTitle}>{e.qualification}</Text>
                    <Text style={styles.profileMeta}>
                      {e.college} · {e.duration}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {candidateDetails.experience.length > 0 && (
              <View style={styles.profileCol}>
                <Text style={[styles.profileTitle, { marginBottom: 4 }]}>Experience</Text>
                {candidateDetails.experience.map((e, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <Text style={styles.profileTitle}>{e.position}</Text>
                    <Text style={styles.profileMeta}>
                      {e.company} · {e.duration}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {candidateDetails.certifications.length > 0 && (
            <View>
              <Text style={[styles.profileTitle, { marginBottom: 4 }]}>Certifications</Text>
              {candidateDetails.certifications.map((c, i) => (
                <Text key={i} style={styles.point}>
                  {c}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );
}

export default function FitmentReportPdf(props: FitmentPdfContentProps) {
  return (
    <Document>
      <PdfPage title="Fitment Report">
        <FitmentPdfContent {...props} />
      </PdfPage>
    </Document>
  );
}
```

- [ ] **Step 2: Run the existing fitment export test, confirm unchanged**

Run: `npx vitest run app/api/hub/report/export/__tests__/route.test.ts`
Expected: PASS (4 tests, unchanged) — proves the extraction didn't change the default export's behavior.

- [ ] **Step 3: Extract `PersonalityPdfContent`**

Read `app/api/hub/personality/export/PersonalityReportPdf.tsx` in full first. Apply the identical extraction pattern: everything currently inside `<PdfPage title="Personality Profile">...</PdfPage>` becomes `export function PersonalityPdfContent({ candidateName, roleTitle, scores, validity }: PersonalityPdfContentProps)` (same props the current default export takes), and the default export becomes:

```tsx
export default function PersonalityReportPdf(props: PersonalityPdfContentProps) {
  return (
    <Document>
      <PdfPage title="Personality Profile">
        <PersonalityPdfContent {...props} />
      </PdfPage>
    </Document>
  );
}
```

Export a `PersonalityPdfContentProps` type alongside it (same shape as the current default export's inline props type). Keep every other line of the file (styles, imports, the trait-mapping JSX) byte-for-byte identical — only the wrapper/export structure changes.

- [ ] **Step 4: Run the existing personality export test, confirm unchanged**

Run: `npx vitest run app/api/hub/personality/export/__tests__/route.test.ts`
Expected: PASS (5 tests, unchanged)

- [ ] **Step 5: Extract `InterviewPdfContent`**

Read `app/api/hub/interview/export/InterviewReportPdf.tsx` in full first. Same pattern: content inside `<PdfPage title="AI Interview Report">...</PdfPage>` becomes `export function InterviewPdfContent({ displayName, roleTitle, infoLine, report }: InterviewPdfContentProps)`, default export becomes the thin wrapper. Export `InterviewPdfContentProps` type.

- [ ] **Step 6: Run the existing interview export test, confirm unchanged**

Run: `npx vitest run app/api/hub/interview/export/__tests__/route.test.ts`
Expected: PASS (4 tests, unchanged)

- [ ] **Step 7: Write the failing test for the combined route**

Create `app/api/hub/export/combined/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

// fitment_leads (used by both the fitment section and the interview section's
// candidate-name/org lookup)
const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

const leadListLimitMock = vi.fn();
const leadListOrderMock = vi.fn().mockReturnValue({ limit: leadListLimitMock });
const leadListEqMock = vi.fn().mockReturnValue({ order: leadListOrderMock });
const leadListSelectMock = vi.fn().mockReturnValue({ eq: leadListEqMock });

const personalityMaybeSingleMock = vi.fn();
const personalityEq2Mock = vi.fn().mockReturnValue({ maybeSingle: personalityMaybeSingleMock });
const personalityEq1Mock = vi.fn().mockReturnValue({ eq: personalityEq2Mock });
const personalitySelectMock = vi.fn().mockReturnValue({ eq: personalityEq1Mock });

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const isReportUnlockedMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({ isReportUnlocked: isReportUnlockedMock }));

const getCandidateResumeDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", async () => {
  const actual = await vi.importActual("@/lib/intervuebox/reports");
  return { ...actual, getCandidateResumeDetails: getCandidateResumeDetailsMock };
});

let leadSelectCallCount = 0;
const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") {
    leadSelectCallCount += 1;
    // First call in the route is always the "list all leads for fitment
    // section" shape (select().eq().order().limit()); later calls (used to
    // resolve interview candidate name/org) use select().eq().eq().order().limit().
    return leadSelectCallCount === 1 ? { select: leadListSelectMock } : { select: leadSelectMock };
  }
  if (table === "personality_tests") return { select: personalitySelectMock };
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(url: string) {
  return new Request(url);
}

describe("GET /api/hub/export/combined", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    leadListLimitMock.mockReset();
    personalityMaybeSingleMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    isReportUnlockedMock.mockReset();
    getCandidateResumeDetailsMock.mockReset();
    leadSelectCallCount = 0;
    getCandidateResumeDetailsMock.mockResolvedValue({
      skills: [],
      education: [],
      experience: [],
      certifications: [],
      phoneNumber: null,
      location: null,
      totalExperience: null,
    });
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when none of the requested types have data", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({ data: [], error: null });
    personalityMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,personality,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF containing only the ready sections when one requested type isn't actually ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [
        {
          role_title: "Senior Product Manager",
          name: "Roshan",
          score: 9.2,
          resume_match_status: "READY",
          resume_match_raw: { overallScore: 92, rank: 1, categories: [], summary: "Great fit.", strongPoints: [], weakPoints: [] },
          ib_applied_job_id: "AJ_1",
        },
      ],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    // interview requested but not ready -> should be silently omitted, not error the whole request
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns a combined PDF when all three requested types are ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [
        {
          role_title: "Senior Product Manager",
          name: "Roshan",
          score: 9.2,
          resume_match_status: "READY",
          resume_match_raw: { overallScore: 92, rank: 1, categories: [], summary: "Great fit.", strongPoints: [], weakPoints: [] },
          ib_applied_job_id: "AJ_1",
        },
      ],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    personalityMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    interviewMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "Senior Product Manager",
        status: "ready",
        updated_at: "2026-07-23T06:54:26.588Z",
        report_raw: {
          overallScore: 8,
          skillMetrics: { relevance: 9 },
          overallSummary: "Solid.",
          strengths: "- Good",
          areasOfImprovement: "- More detail",
          shareableReportLink: null,
          approxDurationMinutes: 4,
        },
      },
      error: null,
    });
    leadMaybeSingleMock.mockResolvedValue({ data: { name: "Roshan", ib_applied_job_id: "AJ_1" }, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,personality,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run app/api/hub/export/combined/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 9: Implement the combined route**

Read `app/api/hub/report/export/route.tsx`, `app/api/hub/personality/export/route.tsx`, and `app/api/hub/interview/export/route.tsx` in full before this step — each's data-fetch chain must be reproduced exactly (same table/column names, same ordering) inside this one route, since it's replacing three separate requests with one.

Create `app/api/hub/export/combined/route.tsx`:
```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { Document } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores, Validity } from "@/lib/personality";
import { nameFromEmail } from "@/lib/personality";
import PdfPage from "@/lib/pdf/PdfPage";
import { FitmentPdfContent } from "../../report/export/FitmentReportPdf";
import { PersonalityPdfContent } from "../../personality/export/PersonalityReportPdf";
import { InterviewPdfContent } from "../../interview/export/InterviewReportPdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const include = new Set((url.searchParams.get("include") ?? "").split(",").filter(Boolean));
  const roleTitle = url.searchParams.get("role");

  const pages: React.ReactNode[] = [];

  if (include.has("fitment")) {
    const { data: leads } = await supabase
      .from("fitment_leads")
      .select("role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const current = leads?.[0];
    if (current) {
      const unlocked = await isReportUnlocked(user.id, current.role_title);
      if (unlocked && current.resume_match_status === "READY" && current.resume_match_raw) {
        const report = current.resume_match_raw as ResumeMatchReportReady;
        const candidateDetails = current.ib_applied_job_id
          ? await getCandidateResumeDetails(current.ib_applied_job_id).catch(() => null)
          : null;
        const formattedDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
        pages.push(
          <PdfPage key="fitment" title="Fitment Report">
            <FitmentPdfContent
              displayName={current.name || user.email || "Candidate"}
              roleTitle={current.role_title}
              formattedDate={formattedDate}
              score={current.score}
              report={report}
              candidateDetails={candidateDetails}
            />
          </PdfPage>
        );
      }
    }
  }

  if (include.has("personality") && roleTitle) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      pages.push(
        <PdfPage key="personality" title="Personality Profile">
          <PersonalityPdfContent
            candidateName={nameFromEmail(user.email ?? "")}
            roleTitle={roleTitle}
            scores={existing.scores as Scores}
            validity={existing.validity as Validity}
          />
        </PdfPage>
      );
    }
  }

  if (include.has("interview")) {
    let query = supabase
      .from("fitment_interviews")
      .select("role_title, status, report_raw, updated_at")
      .eq("user_id", user.id);
    if (roleTitle) {
      query = query.eq("role_title", roleTitle);
    }
    const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (interview && interview.status === "ready" && interview.report_raw) {
      const report = interview.report_raw as InterviewReportReady;
      const { data: lead } = await supabase
        .from("fitment_leads")
        .select("name, ib_applied_job_id")
        .eq("user_id", user.id)
        .eq("role_title", interview.role_title)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const candidateDetails = lead?.ib_applied_job_id
        ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch(() => null)
        : null;
      const organisation = candidateDetails?.experience[0]?.company ?? null;
      const location = candidateDetails?.location ?? null;
      const totalExperience = candidateDetails?.totalExperience ?? null;
      const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const infoLine = [
        organisation,
        totalExperience != null ? `${totalExperience} yrs experience` : null,
        location,
        formattedDate,
        report.approxDurationMinutes != null ? `~${report.approxDurationMinutes} min` : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ");
      pages.push(
        <PdfPage key="interview" title="AI Interview Report">
          <InterviewPdfContent
            displayName={lead?.name || user.email || "Candidate"}
            roleTitle={interview.role_title}
            infoLine={infoLine}
            report={report}
          />
        </PdfPage>
      );
    }
  }

  if (pages.length === 0) {
    return Response.json({ error: "None of the requested reports are ready yet." }, { status: 404 });
  }

  const buffer = await renderToBuffer(<Document>{pages}</Document>);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="merito-report.pdf"`,
    },
  });
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run app/api/hub/export/combined/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 12: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, no regressions (the 3 existing export route tests must still be green, proving the extraction was behavior-preserving)

- [ ] **Step 13: Commit**

```bash
git status --short
```
Review the output, then commit only the files this task touched:
```bash
git add app/api/hub/report/export/FitmentReportPdf.tsx app/api/hub/personality/export/PersonalityReportPdf.tsx app/api/hub/interview/export/InterviewReportPdf.tsx app/api/hub/export/combined/route.tsx app/api/hub/export/combined/__tests__/route.test.ts
git commit -m "feat(hub): add combined one-pager PDF export route"
```

---

### Task 2: Dashboard modal + trigger button

**Files:**
- Create: `app/hub/account/CombinedExportModal.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`

**Interfaces:**
- Consumes: `InterviewStatus`, `PersonalityStatus` (from `./ProgressRail`, already imported by `DashboardClient.tsx`) — exact values `"not_started" | "invited" | "ready"` and `"not_started" | "ready"`.
- Produces: nothing consumed by later tasks (final task)

- [ ] **Step 1: Create the modal**

Read `app/hub/account/InterviewStartModal.tsx` in full before this step — mirror its exact overlay/card/close-button structure.

Create `app/hub/account/CombinedExportModal.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";

type ReportType = "fitment" | "personality" | "interview";

export default function CombinedExportModal({
  roleTitle,
  reportUnlocked,
  personalityStatus,
  interviewStatus,
  onClose,
}: {
  roleTitle: string;
  reportUnlocked: boolean;
  personalityStatus: PersonalityStatus;
  interviewStatus: InterviewStatus;
  onClose: () => void;
}) {
  const availability: Record<ReportType, boolean> = {
    fitment: reportUnlocked,
    personality: personalityStatus === "ready",
    interview: interviewStatus === "ready",
  };

  const [selected, setSelected] = useState<Set<ReportType>>(new Set());

  const toggle = (type: ReportType) => {
    if (!availability[type]) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const labels: Record<ReportType, string> = {
    fitment: "Fitment report",
    personality: "Personality report",
    interview: "AI interview report",
  };

  const canGenerate = selected.size > 0;
  const href = `/api/hub/export/combined?include=${Array.from(selected).join(",")}&role=${encodeURIComponent(roleTitle)}`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}
        >
          ✕
        </button>

        <span
          className="bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 11, borderRadius: 50, padding: "4px 12px", display: "inline-block", marginBottom: 12 }}
        >
          Combined export
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          Pick what to include
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          Choose one or more completed reports to combine into a single PDF.
        </p>

        {(Object.keys(labels) as ReportType[]).map((type) => (
          <label
            key={type}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 4px",
              opacity: availability[type] ? 1 : 0.45,
              cursor: availability[type] ? "pointer" : "default",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(type)}
              disabled={!availability[type]}
              onChange={() => toggle(type)}
            />
            <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14 }}>
              {labels[type]}
              {!availability[type] && (
                <span style={{ color: "#9c9c9c", fontSize: 12 }}> — not completed yet</span>
              )}
            </span>
          </label>
        ))}

        {canGenerate ? (
          <a
            href={href}
            download
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{
              display: "block",
              textAlign: "center",
              height: 50,
              lineHeight: "50px",
              borderRadius: 8,
              fontSize: 15,
              background: "#ed1a24",
              marginTop: 16,
              boxShadow: "0 4px 6px rgba(236,34,40,0.3)",
            }}
            onClick={onClose}
          >
            Generate combined PDF
          </a>
        ) : (
          <button
            disabled
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ height: 50, borderRadius: 8, fontSize: 15, background: "#dcdcdc", border: "none", marginTop: 16, cursor: "default" }}
          >
            Generate combined PDF
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the modal into `DashboardClient.tsx`**

Read `app/hub/account/DashboardClient.tsx` in full first (already read this session — the file has `modal` state as `useState<"none" | "report" | "interview">` and renders `ReportPaywallModal`/`InterviewStartModal` conditionally at the bottom of the returned JSX, with `ProgressRail` receiving `onOpenReportPaywall`/`onOpenInterviewStart` callbacks near the top).

Change the modal state type:
```tsx
const [modal, setModal] = useState<"none" | "report" | "interview" | "export">("none");
```

Add the import:
```tsx
import CombinedExportModal from "./CombinedExportModal";
```

Add a trigger button directly below the closing `</div>` of the `ProgressRail`/main content grid (i.e., as a new sibling element right after the grid `<div>` that currently contains `ProgressRail` and the score section, still inside the outer `<>` fragment, before the existing `{modal === "report" && ...}` block):
```tsx
<div className="mx-auto" style={{ maxWidth: 1440, padding: "0 24px 24px" }}>
  <button
    onClick={() => setModal("export")}
    className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
    style={{ background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}
  >
    Download combined report
  </button>
</div>
```

Add the modal render block alongside the existing two:
```tsx
{modal === "export" && (
  <CombinedExportModal
    roleTitle={roleTitle}
    reportUnlocked={reportUnlocked}
    personalityStatus={personalityStatus}
    interviewStatus={interviewStatus}
    onClose={() => setModal("none")}
  />
)}
```
(`reportUnlocked`, `personalityStatus`, `interviewStatus` are all already in scope in this component — `reportUnlocked` and `interviewStatus` from existing `useState`, `personalityStatus` from the component's own props, passed straight through unchanged.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 5: Manual live verification**

With the dev server running and signed in as a user with at least the fitment report unlocked: navigate to `/hub/account`, click "Download combined report", confirm the modal shows the 3 checkboxes with the correct ones enabled/disabled based on real completion status, check one or more enabled boxes, click "Generate combined PDF", confirm a real multi-section PDF downloads (or single-section if only one was checked) and opens correctly.

- [ ] **Step 6: Commit**

```bash
git status --short
```
Review the output, then commit only the files this task touched:
```bash
git add app/hub/account/CombinedExportModal.tsx app/hub/account/DashboardClient.tsx
git commit -m "feat(hub): add combined-export modal and trigger button to the dashboard"
```
