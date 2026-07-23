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
