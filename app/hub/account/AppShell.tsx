"use client";

import { useState } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import ChangeRoleModal from "./ChangeRoleModal";

export default function AppShell({
  roleTitle,
  userName,
  userEmail,
  children,
}: {
  roleTitle: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [showChangeRole, setShowChangeRole] = useState(false);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 900px 560px at 74% -8%, rgba(237,26,36,0.13), transparent 62%), " +
          "radial-gradient(ellipse 700px 460px at -8% 28%, rgba(237,26,36,0.05), transparent 60%), " +
          "rgb(21,18,22)",
        backgroundAttachment: "fixed",
      }}
    >
      <TopBar roleTitle={roleTitle} userName={userName} userEmail={userEmail} onChangeRole={() => setShowChangeRole(true)} />
      <div className="flex items-start mx-auto" style={{ maxWidth: 1360 }}>
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {showChangeRole && (
        <ChangeRoleModal
          onClose={() => setShowChangeRole(false)}
          onRoleChanged={() => setShowChangeRole(false)}
        />
      )}
    </div>
  );
}
