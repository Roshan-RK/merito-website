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
