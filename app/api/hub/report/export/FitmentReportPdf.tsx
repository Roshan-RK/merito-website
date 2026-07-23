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
