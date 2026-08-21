import { listWebhookEvents } from "@/lib/intervueboxWebhookEvents";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Pagination from "@/app/admin/_components/Pagination";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default async function AdminWebhookEventsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const { rows: events, page, totalPages } = await listWebhookEvents(Number(pageParam) || 1);

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        IntervueBox webhook events
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 24px" }}>
        Every signature-valid delivery received on the IntervueBox webhook, with the outcome of the sweep it triggered. The per-event payload shape isn&apos;t documented by the vendor, so the raw body is shown as-is.
      </p>
      <Table minWidth={760}>
        <TableHeadRow columns={["When", "Sweep result", "Raw payload"]} />
        <tbody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                {formatDateTime(e.createdAt)}
              </TableCell>
              <TableCell>
                {e.sweepError ? (
                  <span style={{ color: "#ed1a24" }}>{e.sweepError}</span>
                ) : e.sweepResult ? (
                  <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12 }}>
                    ready {e.sweepResult.ready} · appeared {e.sweepResult.appeared} · terminated {e.sweepResult.terminated} · errors {e.sweepResult.errors}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <pre
                  className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]"
                  style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflow: "auto", margin: 0 }}
                >
                  {typeof e.rawPayload === "string" ? e.rawPayload : JSON.stringify(e.rawPayload, null, 2)}
                </pre>
              </TableCell>
            </TableRow>
          ))}
          {events.length === 0 && <TableEmptyRow colSpan={3} message="No webhook deliveries recorded yet." />}
        </tbody>
      </Table>
      <Pagination page={page} totalPages={totalPages} basePath="/admin/webhook-events" />
    </div>
  );
}
