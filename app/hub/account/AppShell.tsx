"use client";

import { useState } from "react";
import TopBar from "./TopBar";
import ChangeRoleModal from "./ChangeRoleModal";

export default function AppShell({
  roleTitle,
  userName,
  children,
}: {
  roleTitle: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [showChangeRole, setShowChangeRole] = useState(false);

  return (
    <>
      <TopBar roleTitle={roleTitle} userName={userName} onChangeRole={() => setShowChangeRole(true)} />
      {children}
      {showChangeRole && (
        <ChangeRoleModal
          onClose={() => setShowChangeRole(false)}
          onRoleChanged={() => setShowChangeRole(false)}
        />
      )}
    </>
  );
}
