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
    <div className="min-h-screen bg-[#0a0a0a]">
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
