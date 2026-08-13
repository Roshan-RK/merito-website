import { requireAdmin } from "@/lib/adminAuth";
import AdminSidebar from "@/app/admin/_components/AdminSidebar";
import { ToastProvider } from "@/app/admin/_components/Toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <ToastProvider>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafd" }}>
        <AdminSidebar adminEmail={user.email ?? ""} />
        <main style={{ flex: 1, minWidth: 0, padding: "40px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
