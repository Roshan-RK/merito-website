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
