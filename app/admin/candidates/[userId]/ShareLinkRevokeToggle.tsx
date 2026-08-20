"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

export default function ShareLinkRevokeToggle({ token, revoked }: { token: string; revoked: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/share-links/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked: !revoked }),
      });
      if (response.ok) {
        showToast("success", revoked ? "Share link restored." : "Share link revoked.");
        router.refresh();
      } else {
        showToast("error", "Something went wrong — try again.");
      }
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Button variant={revoked ? "secondary" : "danger"} onClick={() => setConfirmOpen(true)} disabled={saving} loading={saving}>
        {revoked ? "Restore" : "Revoke"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={revoked ? "Restore this share link?" : "Revoke this share link?"}
        message={
          revoked
            ? "The recruiter preview link will become viewable again."
            : "The recruiter preview link will stop working immediately for anyone who has it."
        }
        confirmLabel={revoked ? "Restore" : "Revoke"}
        danger={!revoked}
        busy={saving}
        onConfirm={toggle}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
