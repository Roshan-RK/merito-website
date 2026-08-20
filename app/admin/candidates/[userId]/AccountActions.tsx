"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

type PendingAction =
  | { type: "ban"; reason: string }
  | { type: "delete" }
  | { type: "merge"; target: string };

const inputStyle = { fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7 } as const;
const DELETION_PURGE_WINDOW_DAYS = 30; // must match lib/adminCandidates.ts

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default function AccountActions({
  userId,
  email,
  pendingDeletion,
}: {
  userId: string;
  email: string;
  pendingDeletion: { purgeAfter: string } | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"ban" | "unban" | "delete" | "restore" | "magic-link" | "merge" | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);

  function handleBanClick() {
    const reason = window.prompt("Reason for banning this candidate?");
    if (!reason) return;
    setPending({ type: "ban", reason });
  }

  function handleUnban() {
    run("unban", `/api/admin/candidates/${userId}/unban`);
  }

  async function handleMagicLink() {
    setBusy("magic-link");
    setMagicLink(null);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      setMagicLink(data.link);
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function run(action: "ban" | "unban" | "delete" | "restore" | "merge", url: string, body?: unknown, method: string = "POST") {
    setPending(null);
    setBusy(action);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Done.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  function confirmDialogProps(): { title: string; message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null {
    if (!pending) return null;
    if (pending.type === "ban") {
      return {
        title: "Ban this candidate?",
        message: `They will no longer be able to sign in. Reason: "${pending.reason}"`,
        confirmLabel: "Ban",
        danger: true,
        onConfirm: () => run("ban", `/api/admin/candidates/${userId}/ban`, { reason: pending.reason }),
      };
    }
    if (pending.type === "delete") {
      return {
        title: "Delete this account?",
        message: `Bans ${email} from signing in and schedules their data for permanent erasure in ${DELETION_PURGE_WINDOW_DAYS} days. Reversible with "Restore" until then.`,
        confirmLabel: "Delete",
        danger: true,
        onConfirm: () => run("delete", `/api/admin/candidates/${userId}`, undefined, "DELETE"),
      };
    }
    return {
      title: "Merge accounts?",
      message: `Merges account ${pending.target} into ${email}. The merged-away account will be banned.`,
      confirmLabel: "Merge",
      danger: false,
      onConfirm: () => run("merge", "/api/admin/candidates/merge", { keepUserId: userId, mergeUserId: pending.target }),
    };
  }

  const dialog = confirmDialogProps();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pendingDeletion && (
        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
            Pending deletion — erased on {formatDate(pendingDeletion.purgeAfter)}
          </span>
          <Button variant="secondary" onClick={() => run("restore", `/api/admin/candidates/${userId}/restore`)} disabled={busy !== null} loading={busy === "restore"}>
            Restore
          </Button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button variant="danger" onClick={handleBanClick} disabled={busy !== null || pendingDeletion !== null} loading={busy === "ban"}>
          Ban
        </Button>
        <Button variant="secondary" onClick={handleUnban} disabled={busy !== null || pendingDeletion !== null} loading={busy === "unban"}>
          Unban
        </Button>
        <Button variant="danger" onClick={() => setPending({ type: "delete" })} disabled={busy !== null || pendingDeletion !== null} loading={busy === "delete"}>
          Delete account
        </Button>
        <Button variant="secondary" onClick={handleMagicLink} disabled={busy !== null || pendingDeletion !== null} loading={busy === "magic-link"}>
          Generate magic link
        </Button>
      </div>
      {magicLink && (
        <input readOnly value={magicLink} onFocus={(e) => e.target.select()} className="font-[family-name:var(--font-poppins)]" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          placeholder="Other account's user ID to merge in"
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          className="font-[family-name:var(--font-poppins)]"
          style={{ ...inputStyle, minWidth: 280 }}
        />
        <Button
          variant="secondary"
          onClick={() => mergeTarget.trim() && setPending({ type: "merge", target: mergeTarget.trim() })}
          disabled={busy !== null || !mergeTarget.trim()}
          loading={busy === "merge"}
        >
          Merge into this account
        </Button>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        confirmLabel={dialog?.confirmLabel ?? "Confirm"}
        danger={dialog?.danger ?? false}
        busy={busy === pending?.type}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
