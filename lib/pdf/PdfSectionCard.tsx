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
