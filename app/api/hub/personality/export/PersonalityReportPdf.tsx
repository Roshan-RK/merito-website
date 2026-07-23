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
