# Export Reports (PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download PDF" export to each of the 3 existing report pages (fitment, personality, AI-interview), each backed by a server-side API route that renders a real vector PDF via `@react-pdf/renderer`.

**Architecture:** One shared `lib/pdf/` primitives module (theme constants + 3 reusable layout components), plus one API route + one PDF-layout component per report. Each route re-runs its sibling page's exact data-fetch/auth chain, then renders a `<Document>` to a `Buffer` and returns it as `application/pdf`.

**Tech Stack:** `@react-pdf/renderer` (new dependency), Next.js 16 App Router route handlers (`runtime = "nodejs"`), Vitest.

## Global Constraints

- Colors: `#ed1a24` (primary red), `#16803c` / `#eefdf1` (green success), `#fdeced` (red tint), `#4b4b4d` (muted text), `#9c9c9c` (label gray) — the same values used throughout the rest of the app this session, no new palette.
- Fonts: `@react-pdf/renderer` has no access to this app's web fonts (Gabarito/Poppins) without registering actual font files, which this plan does not bundle (YAGNI — the spec required visual/color consistency, not literal font-family matching in a PDF). Use react-pdf's built-in base fonts: `Helvetica-Bold` for headings, `Helvetica` for body. Note this explicitly in each PDF layout file as a one-line comment so it isn't mistaken for an oversight later.
- Every export route repeats its sibling page's exact ownership gate (`getUser()` + `.eq("user_id", user.id)` on every query) — never trust a role/query-param alone.
- If the underlying data isn't ready (report not unlocked, test not taken, interview not `status: "ready"`), the route returns a 404/403 JSON error body, never a partial/blank PDF.
- PDF generation uses `renderToBuffer` (not `renderToStream`) — simpler to return from a Next.js Route Handler (a `Buffer` is valid `BodyInit`; converting a Node `Readable` to a Web `ReadableStream` for a handful-of-KB PDF isn't worth the extra code).
- Route tests mock Supabase/IntervueBox exactly like `app/api/hub/start-ai-interview/__tests__/route.test.ts` already does (chained query-builder mocks: `.select()` → `.eq()` → `.order()` → `.limit()` → `.maybeSingle()`, each a `vi.fn()` returning the next link) — follow that file's exact mocking shape, don't invent a new one.
- `lib/pdf/` primitives and the 3 PDF-layout components are not unit-tested — matches this repo's existing convention that presentational/visual components have no dedicated render tests (only routes and pure logic functions are tested).
- Spec: `specs/2026-07-23-export-reports-design.md` — read first for full rationale. This plan implements it verbatim; no scope beyond it.

---

### Task 1: Shared PDF primitives + fitment report export (first full vertical slice)

**Files:**
- Create: `lib/pdf/pdfTheme.ts`
- Create: `lib/pdf/PdfPage.tsx`
- Create: `lib/pdf/PdfSectionCard.tsx`
- Create: `lib/pdf/PdfScoreBar.tsx`
- Create: `app/api/hub/report/export/FitmentReportPdf.tsx`
- Create: `app/api/hub/report/export/route.tsx`
- Test: `app/api/hub/report/export/__tests__/route.test.ts`
- Modify: `app/hub/account/report/page.tsx`
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: `ResumeMatchReportReady`, `ResumeMatchCategory` (from `@/lib/intervuebox/reports`), `CandidateResumeDetails` (from `@/lib/intervuebox/reports`), `isReportUnlocked` (from `@/lib/reportUnlocks`)
- Produces: `pdfTheme` (default export, a plain object of color/spacing constants) — Tasks 2 and 3 import this. `PdfPage`, `PdfSectionCard`, `PdfScoreBar` (default exports, React components) — Tasks 2 and 3 import and reuse these directly, same props shape shown below.

- [ ] **Step 1: Install the dependency**

Run: `npm install @react-pdf/renderer`
Expected: `package.json`'s `dependencies` gains `"@react-pdf/renderer": "^4.x.x"` (whatever the installed major version is — don't hand-edit the version string, let npm write it).

- [ ] **Step 2: Create the shared theme constants**

Create `lib/pdf/pdfTheme.ts`:
```ts
const pdfTheme = {
  colors: {
    primary: "#ed1a24",
    green: "#16803c",
    greenBg: "#eefdf1",
    redBg: "#fdeced",
    mutedText: "#4b4b4d",
    labelGray: "#9c9c9c",
    border: "#e0d5d9",
    black: "#0a0a0a",
  },
  spacing: {
    page: 32,
    section: 16,
  },
};

export default pdfTheme;
```

- [ ] **Step 3: Create the shared page wrapper**

Create `lib/pdf/PdfPage.tsx`:
```tsx
// react-pdf has no access to this app's web fonts (Gabarito/Poppins) without
// registering actual font files, which this module deliberately doesn't
// bundle — Helvetica is react-pdf's built-in base font, used everywhere here
// instead. Colors still match the on-screen app exactly (see pdfTheme.ts).
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import pdfTheme from "./pdfTheme";

const styles = StyleSheet.create({
  page: {
    padding: pdfTheme.spacing.page,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: pdfTheme.colors.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: pdfTheme.colors.primary,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: pdfTheme.colors.labelGray,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

export default function PdfPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>Merito</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </Page>
  );
}
```

- [ ] **Step 4: Create the shared section-card component**

Create `lib/pdf/PdfSectionCard.tsx`:
```tsx
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import pdfTheme from "./pdfTheme";

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: pdfTheme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: pdfTheme.colors.labelGray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  body: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
  },
});

export default function PdfSectionCard({
  label,
  backgroundColor,
  children,
}: {
  label: string;
  backgroundColor?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, backgroundColor ? { backgroundColor, borderWidth: 0 } : {}]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 5: Create the shared score-bar component**

Create `lib/pdf/PdfScoreBar.tsx`:
```tsx
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import pdfTheme from "./pdfTheme";

const styles = StyleSheet.create({
  row: { marginBottom: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  score: { fontFamily: "Helvetica-Bold", fontSize: 10, color: pdfTheme.colors.mutedText },
  track: { height: 5, borderRadius: 3, backgroundColor: "#f0e6ea" },
  fill: { height: 5, borderRadius: 3, backgroundColor: pdfTheme.colors.primary },
  comment: { fontFamily: "Helvetica", fontSize: 9, color: pdfTheme.colors.mutedText, marginTop: 4 },
});

// `max` defaults to 100 (fitment report's 0-100 category scores); the
// AI-interview PDF (Task 3) passes max=10 for its 0-10 skill metrics.
export default function PdfScoreBar({
  label,
  score,
  max = 100,
  comment,
}: {
  label: string;
  score: number;
  max?: number;
  comment?: string;
}) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.score}>
          {score}/{max}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      {comment && <Text style={styles.comment}>{comment}</Text>}
    </View>
  );
}
```

- [ ] **Step 6: Create the fitment PDF layout**

Read `app/hub/account/report/page.tsx` and `app/hub/account/report/CandidateProfile.tsx` before this step so the mirrored content matches exactly (candidate name, score, summary, skills, categories, strong/weak points, education/experience/certifications).

Create `app/api/hub/report/export/FitmentReportPdf.tsx`:
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

export default function FitmentReportPdf({
  displayName,
  roleTitle,
  formattedDate,
  score,
  report,
  candidateDetails,
}: {
  displayName: string;
  roleTitle: string;
  formattedDate: string;
  score: number;
  report: ResumeMatchReportReady;
  candidateDetails: CandidateResumeDetails | null;
}) {
  return (
    <Document>
      <PdfPage title="Fitment Report">
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
      </PdfPage>
    </Document>
  );
}
```

- [ ] **Step 7: Write the failing route test**

Create `app/api/hub/report/export/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEqMock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });
const sessionFromMock = vi.fn().mockReturnValue({ select: leadSelectMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: sessionFromMock }),
}));

const isReportUnlockedMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({ isReportUnlocked: isReportUnlockedMock }));

const getCandidateResumeDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", async () => {
  const actual = await vi.importActual("@/lib/intervuebox/reports");
  return { ...actual, getCandidateResumeDetails: getCandidateResumeDetailsMock };
});

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/report/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    isReportUnlockedMock.mockReset();
    getCandidateResumeDetailsMock.mockReset();
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

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when there is no fitment lead", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the report isn't unlocked", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "Senior Product Manager",
        name: "Roshan",
        score: 9.2,
        resume_match_status: "READY",
        resume_match_raw: { overallScore: 92, rank: 1, categories: [], summary: "x", strongPoints: [], weakPoints: [] },
        ib_applied_job_id: "AJ_1",
      },
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(false);
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(403);
  });

  it("returns a PDF when the report is unlocked and ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "Senior Product Manager",
        name: "Roshan",
        score: 9.2,
        resume_match_status: "READY",
        resume_match_raw: {
          overallScore: 92,
          rank: 1,
          categories: [{ key: "skillsMatch", label: "Skills Match", score: 90, comment: "Strong" }],
          summary: "Great fit.",
          strongPoints: ["Point A"],
          weakPoints: ["Gap A"],
        },
        ib_applied_job_id: "AJ_1",
      },
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run app/api/hub/report/export/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'` (route doesn't exist yet).

- [ ] **Step 9: Implement the export route**

Read `app/hub/account/report/page.tsx` in full before this step — the route below must mirror its exact query chain (same table, same columns, same ordering) so the two never drift apart.

Create `app/api/hub/report/export/route.tsx`:
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import FitmentReportPdf from "./FitmentReportPdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];
  if (!current) {
    return Response.json({ error: "No fitment report found." }, { status: 404 });
  }

  const unlocked = await isReportUnlocked(user.id, current.role_title);
  if (!unlocked) {
    return Response.json({ error: "Report not unlocked." }, { status: 403 });
  }

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    return Response.json({ error: "Report not ready yet." }, { status: 404 });
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;

  const candidateDetails = current.ib_applied_job_id
    ? await getCandidateResumeDetails(current.ib_applied_job_id).catch(() => null)
    : null;

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const buffer = await renderToBuffer(
    <FitmentReportPdf
      displayName={displayName}
      roleTitle={current.role_title}
      formattedDate={formattedDate}
      score={current.score}
      report={report}
      candidateDetails={candidateDetails}
    />
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fitment-report.pdf"`,
    },
  });
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run app/api/hub/report/export/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 12: Add the download link to the fitment report page**

Read `app/hub/account/report/page.tsx`'s current header block (the `<Link href="/hub/account">← Back to dashboard</Link>` line) before this step. Add a sibling link right after it:
```tsx
<a
  href="/api/hub/report/export"
  download
  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
  style={{ fontSize: 13, marginLeft: 16 }}
>
  Download PDF
</a>
```
Place it inline next to the existing "← Back to dashboard" link (same line, small left margin) — don't restructure the surrounding layout.

- [ ] **Step 13: Manual live verification**

With the dev server running and signed in as a user with an unlocked, ready fitment report: navigate to `/hub/account/report`, click "Download PDF", confirm a real PDF downloads and opens correctly (text is selectable, colors/content match the on-screen report).

- [ ] **Step 14: Commit**

```bash
git status --short
```
Review the output, then commit only the files this task touched (this repo has many unrelated pre-existing modified files — never use a bare `git commit` or `git add -A`):
```bash
git add package.json package-lock.json lib/pdf/pdfTheme.ts lib/pdf/PdfPage.tsx lib/pdf/PdfSectionCard.tsx lib/pdf/PdfScoreBar.tsx app/api/hub/report/export/FitmentReportPdf.tsx app/api/hub/report/export/route.tsx app/api/hub/report/export/__tests__/route.test.ts app/hub/account/report/page.tsx
git commit -m "feat(hub): add PDF export for the fitment report"
```

---

### Task 2: Personality report export

**Files:**
- Create: `app/api/hub/personality/export/PersonalityReportPdf.tsx`
- Create: `app/api/hub/personality/export/route.tsx`
- Test: `app/api/hub/personality/export/__tests__/route.test.ts`
- Modify: `app/hub/account/personality/page.tsx`

**Interfaces:**
- Consumes: `pdfTheme`, `PdfPage`, `PdfSectionCard` (from Task 1's `lib/pdf/`), `TRAITS`, `TRAIT_NAME`, `TRAIT_MEANING`, `TRAIT_WORK_IMPLICATION`, `BANDS`, `traitLevel`, `validityFlags`, `nameFromEmail`, `Scores`, `Validity` (from `@/lib/personality`)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing route test**

Create `app/api/hub/personality/export/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEqMock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });

const testMaybeSingleMock = vi.fn();
const testEq2Mock = vi.fn().mockReturnValue({ maybeSingle: testMaybeSingleMock });
const testEq1Mock = vi.fn().mockReturnValue({ eq: testEq2Mock });
const testSelectMock = vi.fn().mockReturnValue({ eq: testEq1Mock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") return { select: leadSelectMock };
  if (table === "personality_tests") return { select: testSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

async function importRoute() {
  return await import("../route");
}

function buildRequest(url = "http://localhost/api/hub/personality/export") {
  return new Request(url);
}

describe("GET /api/hub/personality/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    testMaybeSingleMock.mockReset();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when no role can be resolved", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns 404 when the personality test hasn't been taken", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: { role_title: "Senior Product Manager" }, error: null });
    testMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns a PDF when the test has been completed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: { role_title: "Senior Product Manager" }, error: null });
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    testMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("uses the role query param instead of the latest lead when provided", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    testMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest("http://localhost/api/hub/personality/export?role=Backend%20Engineer"));

    expect(response.status).toBe(200);
    expect(leadMaybeSingleMock).not.toHaveBeenCalled();
    expect(testEq1Mock).toHaveBeenCalledWith("role_title", "Backend Engineer");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/hub/personality/export/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create the personality PDF layout**

Read `app/hub/account/personality/PersonalityReport.tsx` in full before this step so the mirrored content matches exactly.

Create `app/api/hub/personality/export/PersonalityReportPdf.tsx`:
```tsx
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import PdfPage from "@/lib/pdf/PdfPage";
import PdfSectionCard from "@/lib/pdf/PdfSectionCard";
import pdfTheme from "@/lib/pdf/pdfTheme";
import {
  TRAITS,
  TRAIT_NAME,
  TRAIT_MEANING,
  TRAIT_WORK_IMPLICATION,
  BANDS,
  traitLevel,
  validityFlags,
  type Scores,
  type Validity,
} from "@/lib/personality";

const styles = StyleSheet.create({
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  subtitle: { fontFamily: "Helvetica", fontSize: 10, color: pdfTheme.colors.mutedText, marginBottom: 16 },
  traitHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  traitName: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  traitScore: { fontFamily: "Helvetica-Bold", fontSize: 11, color: pdfTheme.colors.primary },
  bandStrip: { flexDirection: "row", marginBottom: 8 },
  bandSeg: { flex: 1, height: 6, borderRadius: 3, marginRight: 3 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: pdfTheme.colors.primary,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 2,
  },
  body: { fontSize: 9.5, lineHeight: 1.55, marginBottom: 4 },
  validityGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  validityCell: {
    width: "48%",
    backgroundColor: "#fdf8fb",
    borderRadius: 6,
    padding: 8,
    marginRight: "2%",
    marginBottom: 8,
  },
  validityLabel: { fontSize: 8.5, color: pdfTheme.colors.labelGray },
  validityValue: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 2 },
});

export default function PersonalityReportPdf({
  candidateName,
  roleTitle,
  scores,
  validity,
}: {
  candidateName: string;
  roleTitle: string;
  scores: Scores;
  validity: Validity;
}) {
  const firstName = candidateName.split(/\s+/)[0] || candidateName;
  const flags = validityFlags(validity);

  return (
    <Document>
      <PdfPage title="Personality Profile">
        <Text style={styles.name}>{candidateName}</Text>
        <Text style={styles.subtitle}>Big Five (OCEAN) · fit signal for {roleTitle}</Text>

        {TRAITS.map((t) => {
          const s = scores[t];
          const level = traitLevel(s.pct);
          return (
            <PdfSectionCard key={t} label={`Trait ${TRAITS.indexOf(t) + 1} of ${TRAITS.length}`}>
              <View style={styles.traitHeaderRow}>
                <Text style={styles.traitName}>{TRAIT_NAME[t]}</Text>
                <Text style={styles.traitScore}>
                  {s.pct}% · {BANDS[s.band]}
                </Text>
              </View>
              <View style={styles.bandStrip}>
                {BANDS.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.bandSeg, { backgroundColor: i === s.band ? pdfTheme.colors.primary : "#f0e6ea" }]}
                  />
                ))}
              </View>
              <Text style={styles.sectionLabel}>What it measures</Text>
              <Text style={styles.body}>{TRAIT_MEANING[t]}</Text>
              <Text style={styles.sectionLabel}>What {firstName}&apos;s score suggests at work</Text>
              <Text style={styles.body}>{TRAIT_WORK_IMPLICATION[t][level](firstName)}</Text>
            </PdfSectionCard>
          );
        })}

        <PdfSectionCard label="Response quality & validity checks">
          <View style={styles.validityGrid}>
            <View style={styles.validityCell}>
              <Text style={styles.validityLabel}>Acquiescence (agree bias)</Text>
              <Text style={styles.validityValue}>{validity.meanRaw.toFixed(2)} avg</Text>
            </View>
            <View style={styles.validityCell}>
              <Text style={styles.validityLabel}>Central tendency</Text>
              <Text style={styles.validityValue}>{Math.round(validity.pctMid)}% midpoint</Text>
            </View>
            <View style={styles.validityCell}>
              <Text style={styles.validityLabel}>Consistency</Text>
              <Text style={styles.validityValue}>{validity.incon.toFixed(2)} avg gap</Text>
            </View>
            <View style={styles.validityCell}>
              <Text style={styles.validityLabel}>Social desirability</Text>
              <Text style={styles.validityValue}>{validity.sd.toFixed(2)} avg</Text>
            </View>
          </View>
          <Text style={styles.body}>
            {flags.length === 0
              ? "Validity checks passed — the response pattern looks honest and attentive, so the scores can be read at face value."
              : `Interpret with some caution — the response pattern shows signs of ${flags.join(", ")}.`}
          </Text>
        </PdfSectionCard>
      </PdfPage>
    </Document>
  );
}
```

- [ ] **Step 4: Implement the export route**

Read `app/hub/account/personality/page.tsx` in full before this step — the route below must mirror its exact role-resolution and data-fetch chain.

Create `app/api/hub/personality/export/route.tsx`:
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { nameFromEmail, type Scores, type Validity } from "@/lib/personality";
import PersonalityReportPdf from "./PersonalityReportPdf";

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
  let roleTitle = url.searchParams.get("role");

  if (!roleTitle) {
    const { data: lead } = await supabase
      .from("fitment_leads")
      .select("role_title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    roleTitle = lead?.role_title ?? null;
  }

  if (!roleTitle) {
    return Response.json({ error: "No target role found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (!existing || !existing.scores || !existing.validity) {
    return Response.json({ error: "Personality test not completed yet." }, { status: 404 });
  }

  const candidateName = nameFromEmail(user.email ?? "");

  const buffer = await renderToBuffer(
    <PersonalityReportPdf
      candidateName={candidateName}
      roleTitle={roleTitle}
      scores={existing.scores as Scores}
      validity={existing.validity as Validity}
    />
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="personality-report.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run app/api/hub/personality/export/__tests__/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 7: Add the download link to the personality report page**

Read `app/hub/account/personality/page.tsx`'s current header block before this step. Add a sibling link right after the existing "← Back to dashboard" link, passing the resolved `roleTitle` through as a query param so the export route doesn't need to re-derive it from scratch (though it can if omitted):
```tsx
<a
  href={`/api/hub/personality/export?role=${encodeURIComponent(roleTitle)}`}
  download
  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
  style={{ fontSize: 13, marginLeft: 16 }}
>
  Download PDF
</a>
```

- [ ] **Step 8: Manual live verification**

With the dev server running and signed in as a user who has completed the personality test: navigate to `/hub/account/personality`, click "Download PDF", confirm a real PDF downloads and opens correctly.

- [ ] **Step 9: Commit**

```bash
git status --short
```
Review the output, then commit only the files this task touched:
```bash
git add app/api/hub/personality/export/PersonalityReportPdf.tsx app/api/hub/personality/export/route.tsx app/api/hub/personality/export/__tests__/route.test.ts app/hub/account/personality/page.tsx
git commit -m "feat(hub): add PDF export for the personality report"
```

---

### Task 3: AI-interview report export

**Files:**
- Create: `app/api/hub/interview/export/InterviewReportPdf.tsx`
- Create: `app/api/hub/interview/export/route.tsx`
- Test: `app/api/hub/interview/export/__tests__/route.test.ts`
- Modify: `app/hub/account/interview/page.tsx`

**Interfaces:**
- Consumes: `pdfTheme`, `PdfPage`, `PdfSectionCard`, `PdfScoreBar` (from Task 1's `lib/pdf/`), `InterviewReportReady` (from `@/lib/intervuebox/interviewReports`), `getScoreBand` (from `app/hub/account/interview/InterviewScoreGauge`), `getCandidateResumeDetails` (from `@/lib/intervuebox/reports`)
- Produces: nothing consumed by later tasks (final task)

- [ ] **Step 1: Write the failing route test**

Create `app/api/hub/interview/export/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewEqMock = vi.fn().mockReturnValue({ order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  if (table === "fitment_leads") return { select: leadSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

const getCandidateResumeDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", async () => {
  const actual = await vi.importActual("@/lib/intervuebox/reports");
  return { ...actual, getCandidateResumeDetails: getCandidateResumeDetailsMock };
});

async function importRoute() {
  return await import("../route");
}

function buildRequest(url = "http://localhost/api/hub/interview/export?role=HR%20Business%20Partner") {
  return new Request(url);
}

describe("GET /api/hub/interview/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    leadMaybeSingleMock.mockReset();
    getCandidateResumeDetailsMock.mockReset();
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

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when no interview row exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns 404 when the interview isn't ready yet", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({
      data: { role_title: "HR Business Partner", status: "invited", report_raw: null, updated_at: "2026-07-23T06:00:00Z" },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns a PDF when the interview report is ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "HR Business Partner",
        status: "ready",
        updated_at: "2026-07-23T06:54:26.588Z",
        report_raw: {
          overallScore: 8,
          skillMetrics: { relevance: 9, confidence: 10 },
          overallSummary: "Solid overall.",
          strengths: "- Listens well",
          areasOfImprovement: "- Needs more examples",
          shareableReportLink: "https://hogsmeade.intervuebox.ai/interview-report/abc",
          approxDurationMinutes: 4,
        },
      },
      error: null,
    });
    leadMaybeSingleMock.mockResolvedValue({ data: { name: "Roshan", ib_applied_job_id: "AJ_1" }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/hub/interview/export/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create the AI-interview PDF layout**

Read `app/hub/account/interview/page.tsx`, `app/hub/account/interview/ParameterScoreTile.tsx`, and `app/hub/account/interview/InterviewScoreGauge.tsx` in full before this step so the mirrored content matches exactly.

Create `app/api/hub/interview/export/InterviewReportPdf.tsx`:
```tsx
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import PdfPage from "@/lib/pdf/PdfPage";
import PdfSectionCard from "@/lib/pdf/PdfSectionCard";
import PdfScoreBar from "@/lib/pdf/PdfScoreBar";
import pdfTheme from "@/lib/pdf/pdfTheme";
import { getScoreBand } from "@/app/hub/account/interview/InterviewScoreGauge";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginRight: 8 },
  rolePill: {
    backgroundColor: pdfTheme.colors.primary,
    color: "white",
    fontSize: 9,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  infoLine: { fontSize: 9.5, color: pdfTheme.colors.mutedText, marginBottom: 16 },
  overallScoreBlock: { alignItems: "center", marginBottom: 16 },
  overallScoreNumber: { fontFamily: "Helvetica-Bold", fontSize: 24 },
  overallScoreBand: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 2 },
  sectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 4, marginBottom: 8 },
  point: { fontSize: 9.5, lineHeight: 1.6, marginBottom: 4 },
});

function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default function InterviewReportPdf({
  displayName,
  roleTitle,
  infoLine,
  report,
}: {
  displayName: string;
  roleTitle: string;
  infoLine: string;
  report: InterviewReportReady;
}) {
  const band = getScoreBand(report.overallScore);

  return (
    <Document>
      <PdfPage title="AI Interview Report">
        <View style={styles.headerRow}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.rolePill}>{roleTitle}</Text>
        </View>
        {infoLine && <Text style={styles.infoLine}>{infoLine}</Text>}

        <View style={styles.overallScoreBlock}>
          <Text style={styles.overallScoreNumber}>{report.overallScore}/10</Text>
          <Text style={[styles.overallScoreBand, { color: band.textColor }]}>{band.label}</Text>
        </View>

        <Text style={styles.sectionHeading}>Parameters score</Text>
        {Object.entries(report.skillMetrics ?? {}).map(([skill, score]) => (
          <PdfScoreBar key={skill} label={skill} score={score} max={10} />
        ))}

        <PdfSectionCard label="AI overview">
          <Text style={styles.point}>{report.overallSummary}</Text>
        </PdfSectionCard>

        {report.strengths && (
          <View>
            <Text style={styles.sectionHeading}>Strengths</Text>
            {splitBullets(report.strengths).map((point, i) => (
              <Text key={i} style={styles.point}>
                + {point}
              </Text>
            ))}
          </View>
        )}

        {report.areasOfImprovement && (
          <View>
            <Text style={styles.sectionHeading}>Areas to improve</Text>
            {splitBullets(report.areasOfImprovement).map((point, i) => (
              <Text key={i} style={styles.point}>
                - {point}
              </Text>
            ))}
          </View>
        )}
      </PdfPage>
    </Document>
  );
}
```

- [ ] **Step 4: Implement the export route**

Read `app/hub/account/interview/page.tsx` in full before this step — the route below must mirror its exact query chain and info-line composition.

Create `app/api/hub/interview/export/route.tsx`:
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import InterviewReportPdf from "./InterviewReportPdf";

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
  const roleTitle = url.searchParams.get("role");

  let query = supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw, updated_at")
    .eq("user_id", user.id);

  if (roleTitle) {
    query = query.eq("role_title", roleTitle);
  }

  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!interview) {
    return Response.json({ error: "No AI interview found." }, { status: 404 });
  }
  if (interview.status !== "ready" || !interview.report_raw) {
    return Response.json({ error: "Interview report not ready yet." }, { status: 404 });
  }

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
  const displayName = lead?.name || user.email || "Candidate";
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

  const buffer = await renderToBuffer(
    <InterviewReportPdf displayName={displayName} roleTitle={interview.role_title} infoLine={infoLine} report={report} />
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="interview-report.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run app/api/hub/interview/export/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 7: Add the download link to the interview report page**

Read `app/hub/account/interview/page.tsx`'s current header block before this step. Add a sibling link right after the existing "← Back to dashboard" link:
```tsx
<a
  href={`/api/hub/interview/export?role=${encodeURIComponent(interview.role_title)}`}
  download
  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
  style={{ fontSize: 13, marginLeft: 16 }}
>
  Download PDF
</a>
```

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (this repo's existing 173 plus this plan's new route tests — no regressions)

- [ ] **Step 9: Manual live verification**

With the dev server running and signed in as a user with a `status: "ready"` AI-interview report: navigate to `/hub/account/interview?role=<role>`, click "Download PDF", confirm a real PDF downloads and opens correctly, matching the on-screen content.

- [ ] **Step 10: Commit**

```bash
git status --short
```
Review the output, then commit only the files this task touched:
```bash
git add app/api/hub/interview/export/InterviewReportPdf.tsx app/api/hub/interview/export/route.tsx app/api/hub/interview/export/__tests__/route.test.ts app/hub/account/interview/page.tsx
git commit -m "feat(hub): add PDF export for the AI-interview report"
```
