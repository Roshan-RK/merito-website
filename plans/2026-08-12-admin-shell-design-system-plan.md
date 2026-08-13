# Admin Shell + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/admin` its own chrome-free shell with a shared, hand-rolled component library (`Table`/`Badge`/`Button`/`ConfirmDialog`/`Toast`/`EmptyState`/`Pagination`), then re-skin all 8 existing admin pages onto it, fixing the concrete bugs the audit found along the way.

**Architecture:** A new client component `ChromeGate` wraps `<Navbar />`/`<Footer />`/the Zoho chat loader in `app/layout.tsx`, skipping them on any `/admin/*` pathname. A new `app/admin/_components/` directory holds 8 hand-built presentational components (no new dependency — same Poppins/Gabarito fonts, same red/black brand palette already used everywhere). `app/admin/layout.tsx` is rebuilt around a client `AdminSidebar` (active-link state + logout) and mounts `ToastProvider` once. Every `app/admin/**/page.tsx` and its client subcomponents then get their raw inline-styled `<table>`/`<button>`/colored-`<span>` markup swapped for the shared components — same data, same routes, same `lib/admin*.ts` signatures, zero backend changes.

**Tech Stack:** Next.js App Router (React Server + Client Components), TypeScript, inline `style` objects + Tailwind arbitrary-value classes (repo convention, no component library), vitest (existing `lib/adminCounselling.ts` unit tests only — no new tests, no component-test framework introduced).

## Global Constraints

- Chrome removal is a pathname-gated client wrapper (`ChromeGate`, `usePathname().startsWith("/admin")`), not Next.js route groups — route groups would require moving every marketing route, disproportionate to the problem.
- Sidebar shell, not a topbar. Flat 6-item nav (Overview/Candidates/Payments/Counselling/Extension/Learned Skills), no grouping.
- All new components live under `app/admin/_components/` (admin-scoped), never under a site-wide `components/ui/`.
- No new UI dependency. Hand-built with existing fonts (`--font-poppins`, `--font-gabarito`) and existing brand colors (`#ed1a24` red, `#16803c` green, `#c77700` orange, `#9c9c9c` gray, black/white).
- Sidebar gets a logout link — there is currently no way to sign out from anywhere in `/admin`.
- Re-skin all 8 existing pages onto the shared components; fix the concrete bugs listed below as part of the re-skin; add no new features and touch no backend logic.
- `ConfirmDialog` is required before any destructive/state-changing action fires its request (revoke/restore share link, counselling status change, interview generate/reinvite).
- `Toast` surfaces generic success/failure messages only — the underlying API routes don't return structured error bodies yet (that's a separate sub-project); do not invent structured error parsing.
- Out of scope, do not touch: search/filter/sort/pagination wiring, audit trail, candidate drill-down tab restructure, CSV export, counselling TOCTOU race, interview idempotency, `RAZORPAY_BYPASS` tracking, structured API error responses, multi-admin/roles, `requireAdmin()`/auth model, any new Supabase query or schema change. `lib/admin*.ts` function signatures are untouched.
- No component-test precedent exists in this repo (every test is a vitest unit test on `lib/*.ts` pure functions) — do not introduce one. Verification is manual browser-checking at 1440px and 390px widths, logged in as `roshan@merito.in`, except where a task changes something covered by an existing `lib/__tests__/admin*.test.ts` file.
- Every commit stages only the exact files touched by that task (`git add <exact paths>`, never `-A` or `.`) — this repo has long-lived pre-staged unrelated files.

---

### Task 1: `ChromeGate` — hide marketing chrome on `/admin`

**Files:**
- Create: `components/ChromeGate.tsx`
- Modify: `app/layout.tsx:1-9` (imports), `app/layout.tsx:91-102` (remove Zoho scripts from `<head>`), `app/layout.tsx:187-199` (body wrap)

**Interfaces:**
- Consumes: `Navbar` default export from `@/components/Navbar` (no props), `Footer` default export from `@/components/Footer` (no props) — both already pathname-gate themselves against `/hub/account/*` via `isHubAccountRoute`, independent of this change.
- Produces: `ChromeGate` default export, `function ChromeGate({ children }: { children: React.ReactNode }): JSX.Element`, from `components/ChromeGate.tsx`. Used only by `app/layout.tsx` in this task.

- [ ] **Step 1: Create `components/ChromeGate.tsx`**
```tsx
"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <Script id="zoho-init" strategy="afterInteractive">
        {`
          window.$zoho=window.$zoho || {};
          $zoho.salesiq=$zoho.salesiq||{ready:function(){}}
        `}
      </Script>
      <Script
        id="zsiqscript"
        src="https://salesiq.zohopublic.in/widget?wc=siq60bd6a01da5298e0b5a2257627058c32ba59a589f85784499b5013bfa2af42fc"
        strategy="afterInteractive"
      />
    </>
  );
}
```

- [ ] **Step 2: Update `app/layout.tsx` imports (lines 1-9)**

Replace:
```tsx
import type { Metadata } from "next";
import { Poppins, Gabarito } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Script from "next/script";
import ClientAnalytics from "@/components/ClientAnalytics";
import { siteUrl } from "@/lib/site";
```
with:
```tsx
import type { Metadata } from "next";
import { Poppins, Gabarito } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import ClientAnalytics from "@/components/ClientAnalytics";
import ChromeGate from "@/components/ChromeGate";
import { siteUrl } from "@/lib/site";
```

- [ ] **Step 3: Remove the Zoho `<Script>` block from `<head>` (lines 91-102)**

Delete this block entirely (it now lives inside `ChromeGate`):
```tsx
        {/* Zoho SalesIQ */}
        <Script id="zoho-init" strategy="afterInteractive">
          {`
            window.$zoho=window.$zoho || {};
            $zoho.salesiq=$zoho.salesiq||{ready:function(){}}
          `}
        </Script>
        <Script
          id="zsiqscript"
          src="https://salesiq.zohopublic.in/widget?wc=siq60bd6a01da5298e0b5a2257627058c32ba59a589f85784499b5013bfa2af42fc"
          strategy="afterInteractive"
        />
```
GTM script and JSON-LD blocks stay untouched in `<head>` — they are invisible/analytics-only and must render everywhere, including `/admin`.

- [ ] **Step 4: Wrap the body in `ChromeGate` (lines 187-199)**

Replace:
```tsx
      <body className={`${poppins.variable} ${gabarito.variable} antialiased`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
            height="0" width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Navbar />
          <ClientAnalytics />
          {children}
          <Footer />
      </body>
```
with:
```tsx
      <body className={`${poppins.variable} ${gabarito.variable} antialiased`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
            height="0" width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <ChromeGate>
          <ClientAnalytics />
          {children}
        </ChromeGate>
      </body>
```

- [ ] **Step 5: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors (exit code 0).

- [ ] **Step 6: Manually verify in browser**
Run `npm run dev`, then open `http://localhost:3000/` — confirm Navbar, Footer, and the Zoho chat bubble (bottom-right) still render exactly as before. Open `http://localhost:3000/admin` (log in as `roshan@merito.in` if prompted) — confirm no Navbar, no Footer, no Zoho chat bubble render on any `/admin/*` page.

- [ ] **Step 7: Commit**
```bash
git add components/ChromeGate.tsx app/layout.tsx
git commit -m "feat(admin): hide marketing chrome on /admin via pathname-gated ChromeGate"
```

---

### Task 2: `Toast` — `ToastProvider` + `useToast()`

**Files:**
- Create: `app/admin/_components/Toast.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces (from `@/app/admin/_components/Toast`): `ToastProvider({ children }: { children: React.ReactNode }): JSX.Element` (named export), `useToast(): { showToast: (variant: "success" | "error", text: string) => void }` (named export, throws if called outside a `ToastProvider`). Consumed by Task 10 (mounts `ToastProvider`), Tasks 15/19/20 (call `useToast()`/`showToast`).

- [ ] **Step 1: Create `app/admin/_components/Toast.tsx`**
```tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";
type ToastMessage = { id: number; variant: ToastVariant; text: string };
type ToastContextValue = { showToast: (variant: ToastVariant, text: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { background: string; color: string }> = {
  success: { background: "#16803c", color: "#fff" },
  error: { background: "#ed1a24", color: "#fff" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((variant: ToastVariant, text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, variant, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 200 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ ...VARIANT_STYLE[t.variant], fontSize: 13, padding: "10px 16px", borderRadius: 8, boxShadow: "0 8px 22px rgba(17,35,89,0.16)" }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/Toast.tsx
git commit -m "feat(admin): add ToastProvider/useToast shared component"
```

---

### Task 3: `Button`

**Files:**
- Create: `app/admin/_components/Button.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces (from `@/app/admin/_components/Button`): `Button` default export, `function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; loading?: boolean }): JSX.Element`. `disabled` is true while `loading` is true; `loading` renders `"…"` in place of `children`; `type` defaults to `"button"`. Consumed by Tasks 7, 8, 9, 15, 19, 20.

- [ ] **Step 1: Create `app/admin/_components/Button.tsx`**
```tsx
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "#ed1a24", color: "#fff", border: "1px solid #ed1a24" },
  secondary: { background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc" },
  danger: { background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24" },
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export default function Button({ variant = "primary", loading = false, disabled, type = "button", children, style, ...rest }: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className="font-[family-name:var(--font-poppins)] font-semibold"
      style={{
        ...VARIANT_STYLE[variant],
        fontSize: 13,
        padding: "8px 16px",
        borderRadius: 7,
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/Button.tsx
git commit -m "feat(admin): add shared Button component"
```

---

### Task 4: `Badge`

**Files:**
- Create: `app/admin/_components/Badge.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces (from `@/app/admin/_components/Badge`): `export type BadgeVariant = "success" | "warning" | "neutral" | "danger"`; `Badge` default export, `function Badge({ children, variant }: { children: React.ReactNode; variant?: BadgeVariant }): JSX.Element` (`variant` defaults to `"neutral"`). Consumed by Tasks 12, 13, 14, 16, 18.

- [ ] **Step 1: Create `app/admin/_components/Badge.tsx`**
```tsx
export type BadgeVariant = "success" | "warning" | "neutral" | "danger";

const VARIANT_STYLE: Record<BadgeVariant, { color: string; background: string }> = {
  success: { color: "#16803c", background: "rgba(22,128,60,0.08)" },
  warning: { color: "#c77700", background: "rgba(199,119,0,0.08)" },
  neutral: { color: "#9c9c9c", background: "rgba(156,156,156,0.08)" },
  danger: { color: "#ed1a24", background: "rgba(237,26,36,0.08)" },
};

export default function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const { color, background } = VARIANT_STYLE[variant];
  return (
    <span
      className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
      style={{
        display: "inline-block",
        color,
        background,
        fontSize: 11,
        letterSpacing: "0.03em",
        padding: "4px 10px",
        borderRadius: 50,
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/Badge.tsx
git commit -m "feat(admin): add shared Badge component"
```

---

### Task 5: `EmptyState`

**Files:**
- Create: `app/admin/_components/EmptyState.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces (from `@/app/admin/_components/EmptyState`): `EmptyState` default export, `function EmptyState({ message, tone }: { message: string; tone?: "neutral" | "success" }): JSX.Element` (`tone` defaults to `"neutral"`). Consumed by Task 6 (`TableEmptyRow`).

- [ ] **Step 1: Create `app/admin/_components/EmptyState.tsx`**
```tsx
export default function EmptyState({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div
      className="font-[family-name:var(--font-poppins)]"
      style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, color: tone === "success" ? "#16803c" : "#9c9c9c" }}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/EmptyState.tsx
git commit -m "feat(admin): add shared EmptyState component"
```

---

### Task 6: `Table`

**Files:**
- Create: `app/admin/_components/Table.tsx`

**Interfaces:**
- Consumes: `EmptyState` default export from `@/app/admin/_components/EmptyState` (Task 5), signature `EmptyState({ message, tone }): JSX.Element`.
- Produces (from `@/app/admin/_components/Table`, all named exports): `Table({ children, minWidth }: { children: React.ReactNode; minWidth?: number }): JSX.Element` (wraps in a bordered, rounded, `overflow-x: auto` container — `minWidth` defaults to `640`); `TableHeadRow({ columns }: { columns: string[] }): JSX.Element`; `TableRow({ children }: { children: React.ReactNode }): JSX.Element`; `TableCell({ children, align }: { children: React.ReactNode; align?: "left" | "right" }): JSX.Element` (`align` defaults to `"left"`); `TableEmptyRow({ colSpan, message, tone }: { colSpan: number; message: string; tone?: "neutral" | "success" }): JSX.Element`. Consumed by Tasks 11, 12, 13, 14, 16, 17, 18.

- [ ] **Step 1: Create `app/admin/_components/Table.tsx`**
```tsx
import type { ReactNode } from "react";
import EmptyState from "@/app/admin/_components/EmptyState";

const HEAD_CELL_STYLE: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 11,
  letterSpacing: "0.04em",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const BODY_CELL_STYLE: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
};

export function Table({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="bg-white border border-black/[0.08]" style={{ overflowX: "auto", borderRadius: 14 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth }}>{children}</table>
    </div>
  );
}

export function TableHeadRow({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid #eee" }}>
        {columns.map((label) => (
          <th
            key={label}
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={HEAD_CELL_STYLE}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr style={{ borderBottom: "1px solid #eee" }}>{children}</tr>;
}

export function TableCell({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <td className="font-[family-name:var(--font-poppins)] text-black" style={{ ...BODY_CELL_STYLE, textAlign: align }}>
      {children}
    </td>
  );
}

export function TableEmptyRow({
  colSpan,
  message,
  tone = "neutral",
}: {
  colSpan: number;
  message: string;
  tone?: "neutral" | "success";
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <EmptyState message={message} tone={tone} />
      </td>
    </tr>
  );
}
```
Note: `HEAD_CELL_STYLE`/`BODY_CELL_STYLE` use `padding: "12px 16px"` (real horizontal padding) — this is the direct fix for the payments-table glued-text bug (`AMOUNTSTATUS`), whose root cause is the old inline style `padding: "10px 0"` (vertical-only, zero horizontal gap) repeated across every admin table today.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/Table.tsx
git commit -m "feat(admin): add shared Table component with enforced column padding and overflow wrapper"
```

---

### Task 7: `ConfirmDialog`

**Files:**
- Create: `app/admin/_components/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `Button` default export from `@/app/admin/_components/Button` (Task 3), signature `Button(props: { variant?: "primary"|"secondary"|"danger"; loading?: boolean; onClick?; disabled?; children }): JSX.Element`.
- Produces (from `@/app/admin/_components/ConfirmDialog`): `ConfirmDialog` default export, `function ConfirmDialog(props: { open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }): JSX.Element | null` (`confirmLabel` defaults `"Confirm"`, `cancelLabel` defaults `"Cancel"`, `danger`/`busy` default `false`; renders `null` when `open` is `false`). Consumed by Tasks 15, 19, 20.

- [ ] **Step 1: Create `app/admin/_components/ConfirmDialog.tsx`**
```tsx
"use client";

import Button from "@/app/admin/_components/Button";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onCancel}
    >
      <div className="bg-white" style={{ borderRadius: 14, padding: 24, maxWidth: 360, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 17, margin: "0 0 8px" }}>
          {title}
        </h3>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/ConfirmDialog.tsx
git commit -m "feat(admin): add shared ConfirmDialog component"
```

---

### Task 8: `Pagination` (built, not wired yet)

**Files:**
- Create: `app/admin/_components/Pagination.tsx`

**Interfaces:**
- Consumes: `Button` default export from `@/app/admin/_components/Button` (Task 3).
- Produces (from `@/app/admin/_components/Pagination`): `Pagination` default export, `function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }): JSX.Element | null` (renders `null` when `totalPages <= 1`). Not consumed by any task in this plan — sub-project B wires it to a list once server-side pagination exists.

- [ ] **Step 1: Create `app/admin/_components/Pagination.tsx`**
```tsx
"use client";

import Button from "@/app/admin/_components/Button";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 0" }}>
      <Button variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13 }}>
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
}
```
This file is intentionally unimported by any page in this plan (design spec: "built now, not wired to any list yet — sub-project B consumes it"). Type-checking below confirms it compiles standalone.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/Pagination.tsx
git commit -m "feat(admin): add unwired Pagination component for sub-project B"
```

---

### Task 9: `AdminSidebar`

**Files:**
- Create: `app/admin/_components/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `Button` default export from `@/app/admin/_components/Button` (Task 3); `createSupabaseBrowserClient` named export from `@/lib/supabaseAuth` (existing, same one `app/hub/account/SignOutButton.tsx` already uses — `supabase.auth.signOut(): Promise<{ error: AuthError | null }>`).
- Produces (from `@/app/admin/_components/AdminSidebar`): `AdminSidebar` default export, `function AdminSidebar({ adminEmail }: { adminEmail: string }): JSX.Element`. Consumed by Task 10.

- [ ] **Step 1: Create `app/admin/_components/AdminSidebar.tsx`**
```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import Button from "@/app/admin/_components/Button";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Candidates", href: "/admin/candidates" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Counselling", href: "/admin/counselling" },
  { label: "Extension", href: "/admin/extension" },
  { label: "Learned Skills", href: "/admin/learned-skills" },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/hub/login");
  }

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "28px 20px",
      }}
    >
      <p className="font-[family-name:var(--font-gabarito)] font-semibold" style={{ fontSize: "1.2rem", margin: "0 0 32px" }}>
        Merito Admin
      </p>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname ?? "", item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="font-[family-name:var(--font-poppins)] font-semibold"
              style={{
                fontSize: 14,
                padding: "10px 12px",
                borderRadius: 8,
                color: active ? "#fff" : "rgba(255,255,255,0.6)",
                background: active ? "#ed1a24" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 16, marginTop: 16 }}>
        <p
          className="font-[family-name:var(--font-poppins)]"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 10px", wordBreak: "break-all" }}
        >
          {adminEmail}
        </p>
        <Button variant="danger" onClick={handleSignOut} loading={signingOut} style={{ width: "100%" }}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/admin/_components/AdminSidebar.tsx
git commit -m "feat(admin): add AdminSidebar with active-link state and logout"
```

---

### Task 10: Admin shell wiring (`app/admin/layout.tsx`)

**Files:**
- Modify: `app/admin/layout.tsx:1-39` (full file)

**Interfaces:**
- Consumes: `requireAdmin` named export from `@/lib/adminAuth` (existing, unchanged, returns Supabase `User` with `.email?: string`); `AdminSidebar` default export from `@/app/admin/_components/AdminSidebar` (Task 9), prop `{ adminEmail: string }`; `ToastProvider` named export from `@/app/admin/_components/Toast` (Task 2).
- Produces: nothing new consumed by later tasks — this is the shell every page renders inside.

- [ ] **Step 1: Replace `app/admin/layout.tsx` in full**
```tsx
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
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px: open `/admin`, confirm the black sidebar renders on the left with 6 nav items, "Overview" highlighted red/active; click each nav item, confirm the correct item highlights and content loads to its right; confirm the admin's email and a "Sign out" button render at the sidebar's bottom; click "Sign out", confirm redirect to `/hub/login`. At 390px: reload `/admin`, confirm the page doesn't horizontally scroll the whole viewport (individual tables inside may scroll — that's fixed page-by-page in later tasks).

- [ ] **Step 4: Commit**
```bash
git add app/admin/layout.tsx
git commit -m "feat(admin): rebuild admin shell around AdminSidebar and ToastProvider"
```

---

### Task 11: Re-skin funnel overview (`app/admin/page.tsx`)

**Files:**
- Modify: `app/admin/page.tsx:1-63` (full file)

**Interfaces:**
- Consumes: `Table`, `TableRow`, `TableCell` named exports from `@/app/admin/_components/Table` (Task 6).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/page.tsx` in full**
```tsx
import { getSupabaseServerClient } from "@/lib/supabase";
import { Table, TableRow, TableCell } from "@/app/admin/_components/Table";

const REFERENCE_STATUSES = ["initiated", "in_progress", "completed", "cancelled"] as const;

async function getFunnelCounts() {
  const supabase = getSupabaseServerClient();

  const [{ data: leadRows }, { count: reportsUnlocked }, { count: interviewsStarted }, { count: interviewsCompleted }, { count: personalityCompleted }, { data: referenceRows }] =
    await Promise.all([
      supabase.from("fitment_leads").select("user_id"),
      supabase.from("report_unlocks").select("*", { count: "exact", head: true }),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "invited"),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "ready"),
      supabase.from("personality_tests").select("*", { count: "exact", head: true }),
      supabase.from("reference_checks").select("status"),
    ]);

  const fitmentStarted = new Set((leadRows ?? []).map((r) => r.user_id)).size;

  const referenceCounts: Record<string, number> = Object.fromEntries(REFERENCE_STATUSES.map((s) => [s, 0]));
  for (const row of referenceRows ?? []) {
    if (row.status in referenceCounts) referenceCounts[row.status] += 1;
  }

  return {
    fitmentStarted,
    reportsUnlocked: reportsUnlocked ?? 0,
    interviewsStarted: interviewsStarted ?? 0,
    interviewsCompleted: interviewsCompleted ?? 0,
    personalityCompleted: personalityCompleted ?? 0,
    referenceCounts,
  };
}

export default async function AdminFunnelPage() {
  const stats = await getFunnelCounts();

  const rows: Array<[string, number]> = [
    ["Fitment check started", stats.fitmentStarted],
    ["Report unlocked (paid)", stats.reportsUnlocked],
    ["Interview started", stats.interviewsStarted],
    ["Interview completed", stats.interviewsCompleted],
    ["Personality test completed", stats.personalityCompleted],
    ...REFERENCE_STATUSES.map((s): [string, number] => [`References — ${s}`, stats.referenceCounts[s]]),
  ];

  return (
    <Table>
      <tbody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell>
            <TableCell align="right">
              <strong className="text-black">{value}</strong>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin`, confirm the funnel stat rows render inside a bordered, rounded card with the count right-aligned and bold, matching the numbers shown before this change (spot-check 2-3 values against the previous plain-table version if unsure).

- [ ] **Step 4: Commit**
```bash
git add app/admin/page.tsx
git commit -m "refactor(admin): re-skin funnel overview onto shared Table"
```

---

### Task 12: Re-skin candidates list + fix null-userId dead link (`app/admin/candidates/page.tsx`)

**Files:**
- Modify: `app/admin/candidates/page.tsx:1-57` (full file)

**Interfaces:**
- Consumes: `listCandidates`, `FUNNEL_STAGE_LABEL` named exports from `@/lib/adminCandidates` (existing, unchanged — `CandidateListRow.userId` is typed `string` but can be empty/null at runtime, which is exactly the bug being fixed here defensively without touching the lib's type); `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6); `Badge` default export + `BadgeVariant` type from `@/app/admin/_components/Badge` (Task 4).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/candidates/page.tsx` in full**
```tsx
import Link from "next/link";
import { listCandidates, FUNNEL_STAGE_LABEL } from "@/lib/adminCandidates";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";

export default async function AdminCandidatesPage() {
  const candidates = await listCandidates();

  return (
    <Table>
      <TableHeadRow columns={["Name", "Email", "Latest role", "First seen", "Funnel stage"]} />
      <tbody>
        {candidates.map((c) => (
          <TableRow key={c.userId ?? c.email}>
            <TableCell>
              {c.userId ? (
                <Link
                  href={`/admin/candidates/${c.userId}`}
                  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                >
                  {c.name || "—"}
                </Link>
              ) : (
                <span
                  className="font-[family-name:var(--font-poppins)] font-semibold text-black"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  {c.name || "—"}
                  <Badge variant="neutral">Not linked</Badge>
                </span>
              )}
            </TableCell>
            <TableCell>{c.email}</TableCell>
            <TableCell>{c.latestRoleTitle}</TableCell>
            <TableCell>
              {new Date(c.firstSeenAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </TableCell>
            <TableCell>
              <Badge variant="neutral">{FUNNEL_STAGE_LABEL[c.funnelStage]}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {candidates.length === 0 && <TableEmptyRow colSpan={5} message="No candidates yet." />}
      </tbody>
    </Table>
  );
}
```
Bug fix: `c.userId ? <Link>...</Link> : <span>...</span>` — a row with no linked `userId` now renders as non-clickable plain text with a "Not linked" badge instead of a dead link to `/admin/candidates/null`.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin/candidates`, confirm the table renders inside the bordered card with real column gaps (no glued text), confirm the Funnel stage column shows a gray pill badge. If any row has no linked user account, confirm its name renders as plain text with a "Not linked" badge (not a red link) and clicking it does nothing; for rows with a `userId`, confirm the name is still a working red link to `/admin/candidates/<userId>`. At 390px, confirm the table scrolls horizontally inside its own card rather than clipping/breaking the page layout.

- [ ] **Step 4: Commit**
```bash
git add app/admin/candidates/page.tsx
git commit -m "fix(admin): stop rendering dead /admin/candidates/null link; re-skin onto shared Table"
```

---

### Task 13: Re-skin payments (`app/admin/payments/page.tsx`) — fixes glued-text bug

**Files:**
- Modify: `app/admin/payments/page.tsx:1-131` (full file)

**Interfaces:**
- Consumes: `listTransactions`, `listUnpaidUnlocks`, `TransactionStatus` type from `@/lib/adminPayments` (existing, unchanged); `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6); `Badge` default export + `BadgeVariant` type from `@/app/admin/_components/Badge` (Task 4).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/payments/page.tsx` in full**
```tsx
import { listTransactions, listUnpaidUnlocks, type TransactionStatus } from "@/lib/adminPayments";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge, { type BadgeVariant } from "@/app/admin/_components/Badge";

const STATUS_VARIANT: Record<TransactionStatus, BadgeVariant> = {
  initiated: "neutral",
  success: "success",
  failed: "danger",
  refunded: "warning",
};

const PRODUCT_LABEL: Record<string, string> = {
  report: "Report",
  personality: "Personality",
  references: "References",
  interview: "Interview",
  counselling: "Counselling",
  bundle: "Bundle",
};

const UNPAID_KIND_LABEL: Record<string, string> = {
  report: "Report",
  personality: "Personality",
  references: "References",
};

function formatAmount(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminPaymentsPage() {
  const [transactions, unpaidUnlocks] = await Promise.all([listTransactions(), listUnpaidUnlocks()]);

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <Table>
          <TableHeadRow columns={["Candidate", "Product", "Level", "Amount", "Status", "Date"]} />
          <tbody>
            {transactions.map((t) => (
              <TableRow key={t.orderId}>
                <TableCell>{t.email}</TableCell>
                <TableCell>
                  {PRODUCT_LABEL[t.product] ?? t.product}
                  {t.roleTitle && <span className="text-[#9c9c9c]"> · {t.roleTitle}</span>}
                </TableCell>
                <TableCell>{t.level}</TableCell>
                <TableCell>{formatAmount(t.amountPaise)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                </TableCell>
                <TableCell>{formatDate(t.createdAt)}</TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && <TableEmptyRow colSpan={6} message="No payments yet." />}
          </tbody>
        </Table>
      </div>

      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: "0 0 14px" }}>
        Unlocked without payment
      </h2>
      <Table>
        <TableHeadRow columns={["Candidate", "Unlock", "Date"]} />
        <tbody>
          {unpaidUnlocks.map((u, i) => (
            <TableRow key={`${u.userId}-${u.kind}-${u.leadId ?? i}`}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                {UNPAID_KIND_LABEL[u.kind]}
                {u.roleTitle && <span className="text-[#9c9c9c]"> · {u.roleTitle}</span>}
              </TableCell>
              <TableCell>{formatDate(u.unlockedAt)}</TableCell>
            </TableRow>
          ))}
          {unpaidUnlocks.length === 0 && <TableEmptyRow colSpan={3} message="None — good." tone="success" />}
        </tbody>
      </Table>
    </div>
  );
}
```
Bug fix: the old glued-text bug (`AMOUNTSTATUS`, `deepakbansal5387@Gmail.comReport`) came from every `<th>`/`<td>` using `padding: "10px 0"` (zero horizontal padding). `Table`'s cells now use `padding: "12px 16px"` (Task 6), which structurally cannot glue adjacent columns together.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin/payments`, confirm every column header and every cell value has clear visual gaps from its neighbors (no `AMOUNTSTATUS`-style glued text anywhere), confirm the Status column renders as a colored pill (green=success, red=failed, orange=refunded, gray=initiated), confirm the second table's positive empty state ("None — good.") renders in green when there are no unpaid unlocks.

- [ ] **Step 4: Commit**
```bash
git add app/admin/payments/page.tsx
git commit -m "fix(admin): fix glued-column-text bug in payments tables; re-skin onto shared Table"
```

---

### Task 14: Re-skin counselling list (`app/admin/counselling/page.tsx`)

**Files:**
- Modify: `app/admin/counselling/page.tsx:1-89` (full file)

**Interfaces:**
- Consumes: `listCounsellingRequests`, `CounsellingStatus` type from `@/lib/adminCounselling` (existing, unchanged); `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6); `Badge` default export + `BadgeVariant` type from `@/app/admin/_components/Badge` (Task 4).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/counselling/page.tsx` in full**
```tsx
import Link from "next/link";
import { listCounsellingRequests, type CounsellingStatus } from "@/lib/adminCounselling";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge, { type BadgeVariant } from "@/app/admin/_components/Badge";

const STATUS_VARIANT: Record<CounsellingStatus, BadgeVariant> = {
  requested: "warning",
  scheduled: "neutral",
  completed: "success",
  cancelled: "danger",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminCounsellingPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const includeAll = all === "1";
  const requests = await listCounsellingRequests(includeAll);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: 0 }}>
          {includeAll ? "All requests" : "Active queue (requested + scheduled)"}
        </p>
        <Link
          href={includeAll ? "/admin/counselling" : "/admin/counselling?all=1"}
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          {includeAll ? "Show active only" : "Show all"}
        </Link>
      </div>

      <Table>
        <TableHeadRow columns={["Candidate", "Order", "Status", "Requested", "Scheduled"]} />
        <tbody>
          {requests.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link href={`/admin/counselling/${r.id}`} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                  {r.email}
                </Link>
              </TableCell>
              <TableCell>{r.orderId}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
              </TableCell>
              <TableCell>{formatDate(r.requestedAt)}</TableCell>
              <TableCell>{formatDate(r.scheduledAt)}</TableCell>
            </TableRow>
          ))}
          {requests.length === 0 && (
            <TableEmptyRow colSpan={5} message={includeAll ? "No counselling requests yet." : "Queue is empty — nothing to schedule."} />
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin/counselling`, confirm the "Show all"/"Show active only" toggle link still works, confirm Status renders as a colored pill (orange=requested, gray=scheduled, green=completed, red=cancelled), confirm the empty-queue message differs correctly between the active-only and show-all views.

- [ ] **Step 4: Commit**
```bash
git add app/admin/counselling/page.tsx
git commit -m "refactor(admin): re-skin counselling list onto shared Table and Badge"
```

---

### Task 15: Fix status-select default bug + re-skin (`app/admin/counselling/[id]/CounsellingStatusForm.tsx`)

**Files:**
- Modify: `app/admin/counselling/[id]/CounsellingStatusForm.tsx:1-117` (full file)
- Test: none — `lib/adminCounselling.ts` (`CounsellingStatus`, `ALLOWED_TRANSITIONS`, `nextCounsellingState`) is **not modified** by this task, so `lib/__tests__/adminCounselling.test.ts` needs no changes. That test file already asserts `nextCounsellingState("requested", "requested", NOW)` throws (`"throws on no-op transitions (same status)"`), which is exactly why this task disables Save instead of ever submitting a same-status PATCH — confirmed by reading that test before writing this task.

**Interfaces:**
- Consumes: `CounsellingStatus` type from `@/lib/adminCounselling` (existing, unchanged); `Button` default export from `@/app/admin/_components/Button` (Task 3); `ConfirmDialog` default export from `@/app/admin/_components/ConfirmDialog` (Task 7); `useToast` named export from `@/app/admin/_components/Toast` (Task 2).
- Produces: `CounsellingStatusForm` default export keeps its existing prop signature `{ id: string; currentStatus: CounsellingStatus; currentNotes: string | null; allowedNext: CounsellingStatus[] }` — unchanged, so `app/admin/counselling/[id]/page.tsx` (not modified in this plan) keeps working without edits.

- [ ] **Step 1: Replace `app/admin/counselling/[id]/CounsellingStatusForm.tsx` in full**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounsellingStatus } from "@/lib/adminCounselling";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

const STATUS_LABEL: Record<CounsellingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CounsellingStatusForm({
  id,
  currentStatus,
  currentNotes,
  allowedNext,
}: {
  id: string;
  currentStatus: CounsellingStatus;
  currentNotes: string | null;
  allowedNext: CounsellingStatus[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<CounsellingStatus>(currentStatus);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (allowedNext.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        {STATUS_LABEL[currentStatus]} is final — no further status changes.
      </p>
    );
  }

  const isNoOp = status === currentStatus;

  async function handleSave() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/counselling/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (response.ok) {
        showToast("success", "Counselling request updated.");
        router.refresh();
      } else {
        const body = await response.json().catch(() => null);
        showToast("error", body?.error ?? "Something went wrong — try again.");
      }
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
      <label
        htmlFor="status-select"
        className="font-[family-name:var(--font-poppins)] font-semibold text-black"
        style={{ fontSize: 13, display: "block", marginBottom: 8 }}
      >
        Change status
      </label>
      <select
        id="status-select"
        value={status}
        onChange={(e) => setStatus(e.target.value as CounsellingStatus)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 14 }}
      >
        <option value={currentStatus}>{STATUS_LABEL[currentStatus]} (current)</option>
        {allowedNext.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <label
        htmlFor="notes"
        className="font-[family-name:var(--font-poppins)] font-semibold text-black"
        style={{ fontSize: 13, display: "block", marginBottom: 8 }}
      >
        Notes
      </label>
      <textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="font-[family-name:var(--font-poppins)]"
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 8, resize: "vertical" }}
      />

      {isNoOp && (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 14px" }}>
          Choose a new status above to save a change.
        </p>
      )}

      <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={saving || isNoOp} loading={saving}>
        Save
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Change counselling status?"
        message={`This changes the status from "${STATUS_LABEL[currentStatus]}" to "${STATUS_LABEL[status]}".`}
        confirmLabel="Confirm"
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
```
Bug fix: the `<select>` now defaults to `currentStatus` (added as its own first `<option>`, labeled "(current)") instead of `allowedNext[0]`, so an admin who never touches the dropdown makes no transition. Because `nextCounsellingState` in `lib/adminCounselling.ts` explicitly throws on a same-status transition (see the Test note above), Save stays disabled (`isNoOp`) until the admin picks a genuinely different status — this is what makes the default a *true* no-op rather than one that would 400 on submit. `ConfirmDialog` now gates the actual PATCH, and `useToast` replaces the old inline `errorMessage`/`saveState==="error"` paragraph with success/failure toasts.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the existing counselling lib test suite to confirm it's untouched by this change**
Run: `npx vitest run lib/__tests__/adminCounselling.test.ts`
Expected: all 8 existing tests pass unchanged (this task did not modify `lib/adminCounselling.ts`).

- [ ] **Step 4: Manually verify in browser**
At 1440px: open `/admin/counselling`, click into a request with status "Requested". Confirm the status dropdown shows "Requested (current)" pre-selected and the Save button is disabled with the "Choose a new status above" hint visible. Select "Scheduled", confirm Save becomes enabled; click Save, confirm a confirm dialog appears quoting the from/to statuses; click Confirm, confirm a success toast appears and the page updates to show the new status. Repeat once forcing a failure (e.g. stop the dev server's network briefly or throttle to offline in devtools right before confirming) and confirm an error toast appears instead of a silent failure.

- [ ] **Step 5: Commit**
```bash
git add app/admin/counselling/[id]/CounsellingStatusForm.tsx
git commit -m "fix(admin): default counselling status select to current status, not first transition"
```

---

### Task 16: Re-skin extension usage (`app/admin/extension/page.tsx`)

**Files:**
- Modify: `app/admin/extension/page.tsx:1-52` (full file)

**Interfaces:**
- Consumes: `getLookupStats`, `listRecentLookups` named exports from `@/lib/adminExtension` (existing, unchanged); `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6); `Badge` default export from `@/app/admin/_components/Badge` (Task 4).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/extension/page.tsx` in full**
```tsx
import { getLookupStats, listRecentLookups } from "@/lib/adminExtension";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminExtensionPage() {
  const [stats, lookups] = await Promise.all([getLookupStats(), listRecentLookups()]);

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, margin: "0 0 24px" }}>
        {stats.totalLookups} total lookups · {stats.matchedLookups} matched · {stats.last30DaysLookups} in the last 30 days
      </p>

      <Table>
        <TableHeadRow columns={["Candidate", "Date"]} />
        <tbody>
          {lookups.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.email ?? <Badge variant="neutral">No match</Badge>}</TableCell>
              <TableCell>{formatDate(l.createdAt)}</TableCell>
            </TableRow>
          ))}
          {lookups.length === 0 && <TableEmptyRow colSpan={2} message="No lookups yet." />}
        </tbody>
      </Table>
    </div>
  );
}
```
The plain-text "No match" per-row value becomes a neutral badge for visual consistency; the shared list-level empty state (`TableEmptyRow`) now handles the zero-lookups case, matching every other re-skinned page. The ~30 low-signal "No match" rows themselves are not filtered out — that's sub-project B1's job.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin/extension`, confirm the stats line still shows the same 3 numbers as before, confirm rows with no matched candidate show a gray "No match" pill instead of plain gray text, confirm the table scrolls inside its card at 390px rather than clipping.

- [ ] **Step 4: Commit**
```bash
git add app/admin/extension/page.tsx
git commit -m "refactor(admin): re-skin extension usage page onto shared Table and Badge"
```

---

### Task 17: Re-skin learned skills (`app/admin/learned-skills/page.tsx`)

**Files:**
- Modify: `app/admin/learned-skills/page.tsx:1-55` (full file)

**Interfaces:**
- Consumes: `listLearnedSkills` named export from `@/lib/adminLearnedSkills` (existing, unchanged); `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `app/admin/learned-skills/page.tsx` in full**
```tsx
import { listLearnedSkills } from "@/lib/adminLearnedSkills";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminLearnedSkillsPage() {
  const skills = await listLearnedSkills();

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, margin: "0 0 24px" }}>
        {skills.length} skills learned from job descriptions, not yet in the fallback keyword list.
      </p>

      <Table>
        <TableHeadRow columns={["Skill", "Sample job", "First seen"]} />
        <tbody>
          {skills.map((s) => (
            <TableRow key={s.skill}>
              <TableCell>{s.skill}</TableCell>
              <TableCell>{s.sampleJobTitle ?? <span className="text-[#9c9c9c]">—</span>}</TableCell>
              <TableCell>{formatDate(s.firstSeenAt)}</TableCell>
            </TableRow>
          ))}
          {skills.length === 0 && <TableEmptyRow colSpan={3} message="No learned skills yet." />}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
At 1440px and 390px: open `/admin/learned-skills`, confirm the count line and table render as before with real column gaps.

- [ ] **Step 4: Commit**
```bash
git add app/admin/learned-skills/page.tsx
git commit -m "refactor(admin): re-skin learned skills page onto shared Table"
```

---

### Task 18: Re-skin candidate detail's share-links table (`app/admin/candidates/[userId]/page.tsx`)

**Files:**
- Modify: `app/admin/candidates/[userId]/page.tsx:1-17` (add 2 imports), `app/admin/candidates/[userId]/page.tsx:185-234` (share-links table block)

**Interfaces:**
- Consumes: `Table`, `TableHeadRow`, `TableRow`, `TableCell`, `TableEmptyRow` from `@/app/admin/_components/Table` (Task 6); `Badge` default export from `@/app/admin/_components/Badge` (Task 4); `ShareLinkRevokeToggle` default export from `./ShareLinkRevokeToggle`, unchanged prop signature `{ token: string; revoked: boolean }` — the call site below is written exactly as it exists today, so it stays valid whether Task 18 or Task 19 lands first.
- Produces: nothing consumed by later tasks. This task does **not** touch the fitment/interview/personality/references sections above it, and does **not** introduce tabs — both explicitly out of scope for this sub-project.

- [ ] **Step 1: Add imports (top of file, after existing imports, before `formatDate`)**

In the existing import block (lines 1-17), add after `import InterviewRecoveryActions from "./InterviewRecoveryActions";`:
```tsx
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";
```

- [ ] **Step 2: Replace the share-links table block (lines 185-234)**

Replace:
```tsx
        {candidate.recruiterPreview.shareLinks.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                {["Role", "Status", "Views", "Last viewed", "Created", ""].map((label) => (
                  <th
                    key={label}
                    className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
                    style={{ padding: "10px 0", fontSize: 11, letterSpacing: "0.04em", textAlign: "left" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidate.recruiterPreview.shareLinks.map((link) => (
                <tr key={link.token} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {link.roleTitle}
                  </td>
                  <td style={{ padding: "10px 0", fontSize: 13 }}>
                    <span
                      className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
                      style={{ color: link.revoked ? "#9c9c9c" : "#16803c", fontSize: 11.5 }}
                    >
                      {link.revoked ? "Revoked" : "Active"}
                    </span>
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {link.viewCount}
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {formatDate(link.lastViewedAt)}
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {formatDate(link.createdAt)}
                  </td>
                  <td style={{ padding: "10px 0", fontSize: 14 }}>
                    <ShareLinkRevokeToggle token={link.token} revoked={link.revoked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
            No share links created yet.
          </p>
        )}
```
with:
```tsx
        <Table>
          <TableHeadRow columns={["Role", "Status", "Views", "Last viewed", "Created", ""]} />
          <tbody>
            {candidate.recruiterPreview.shareLinks.map((link) => (
              <TableRow key={link.token}>
                <TableCell>{link.roleTitle}</TableCell>
                <TableCell>
                  <Badge variant={link.revoked ? "neutral" : "success"}>{link.revoked ? "Revoked" : "Active"}</Badge>
                </TableCell>
                <TableCell>{link.viewCount}</TableCell>
                <TableCell>{formatDate(link.lastViewedAt)}</TableCell>
                <TableCell>{formatDate(link.createdAt)}</TableCell>
                <TableCell>
                  <ShareLinkRevokeToggle token={link.token} revoked={link.revoked} />
                </TableCell>
              </TableRow>
            ))}
            {candidate.recruiterPreview.shareLinks.length === 0 && (
              <TableEmptyRow colSpan={6} message="No share links created yet." />
            )}
          </tbody>
        </Table>
```

- [ ] **Step 3: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify in browser**
At 1440px and 390px: open a candidate detail page (`/admin/candidates/<userId>`) for a candidate with at least one share link, confirm the Recruiter Preview share-links table renders inside the bordered card with a colored status pill, confirm the rest of the page (fitment report, interview report, personality, references) is visually unchanged. Open a candidate with zero share links, confirm the "No share links created yet." message now renders inside the table's card rather than as a bare paragraph.

- [ ] **Step 5: Commit**
```bash
git add app/admin/candidates/[userId]/page.tsx
git commit -m "refactor(admin): re-skin candidate detail share-links table onto shared Table and Badge"
```

---

### Task 19: Re-skin + confirm-gate share-link revoke (`app/admin/candidates/[userId]/ShareLinkRevokeToggle.tsx`)

**Files:**
- Modify: `app/admin/candidates/[userId]/ShareLinkRevokeToggle.tsx:1-44` (full file)

**Interfaces:**
- Consumes: `Button` default export from `@/app/admin/_components/Button` (Task 3); `ConfirmDialog` default export from `@/app/admin/_components/ConfirmDialog` (Task 7); `useToast` named export from `@/app/admin/_components/Toast` (Task 2); `PATCH /api/admin/share-links/[token]` (existing, unchanged — accepts `{ revoked: boolean }`, returns `{ ok: true }` on success or `{ error: string }` with a 4xx status on failure, per `app/api/admin/share-links/[token]/route.ts`).
- Produces: `ShareLinkRevokeToggle` default export keeps its existing prop signature `{ token: string; revoked: boolean }` — unchanged, matching Task 18's call site exactly.

- [ ] **Step 1: Replace `app/admin/candidates/[userId]/ShareLinkRevokeToggle.tsx` in full**
```tsx
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
```
Bug fix: the old version's `fetch` had no failure branch at all (silently did nothing if `response.ok` was false, and would throw uncaught on a network error). It now shows a success or error toast every time, and both directions of the toggle are gated behind `ConfirmDialog` before firing.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
On a candidate detail page with a share link: click "Revoke", confirm a confirm dialog appears; click Confirm, confirm a success toast appears and the row's badge flips to "Revoked" (gray) with the button now reading "Restore". Click "Restore", confirm the same confirm → toast → badge-flip flow in reverse. Force a failure (e.g. throttle devtools to offline right before confirming) and confirm an error toast appears instead of a silent no-op.

- [ ] **Step 4: Commit**
```bash
git add app/admin/candidates/[userId]/ShareLinkRevokeToggle.tsx
git commit -m "fix(admin): surface toast feedback and require confirmation before share-link revoke/restore"
```

---

### Task 20: Re-skin + confirm-gate interview recovery actions (`app/admin/candidates/[userId]/InterviewRecoveryActions.tsx`)

**Files:**
- Modify: `app/admin/candidates/[userId]/InterviewRecoveryActions.tsx:1-58` (full file)

**Interfaces:**
- Consumes: `Button` default export from `@/app/admin/_components/Button` (Task 3); `ConfirmDialog` default export from `@/app/admin/_components/ConfirmDialog` (Task 7); `useToast` named export from `@/app/admin/_components/Toast` (Task 2); `POST /api/admin/interviews/[id]/generate` and `POST /api/admin/interviews/[id]/reinvite` (existing, unchanged — both return `{ error: string }` on failure or a success body, matching the original component's handling).
- Produces: `InterviewRecoveryActions` default export keeps its existing prop signature `{ interviewId: string; status: string }` — unchanged, matching `app/admin/candidates/[userId]/page.tsx:114`'s existing call site (not modified by this plan).

- [ ] **Step 1: Replace `app/admin/candidates/[userId]/InterviewRecoveryActions.tsx` in full**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

type Action = "generate" | "reinvite";

const ACTION_COPY: Record<Action, { title: string; message: string; confirmLabel: string }> = {
  generate: {
    title: "Generate interview report?",
    message: "Requests a report generation from IntervueBox for this interview. Only do this if the interview is stuck with no report.",
    confirmLabel: "Generate report",
  },
  reinvite: {
    title: "Reinvite candidate?",
    message: "Resends the interview invitation email to the candidate.",
    confirmLabel: "Reinvite",
  },
};

export default function InterviewRecoveryActions({ interviewId, status }: { interviewId: string; status: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);

  async function run(action: Action) {
    setPendingAction(null);
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", action === "generate" ? "Report generation requested." : `Reinvited (${data.invited} sent).`);
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  const activeAction = pendingAction ?? "generate";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
        Status: {status}
      </span>
      <Button variant="danger" onClick={() => setPendingAction("generate")} disabled={busy !== null} loading={busy === "generate"}>
        Generate report
      </Button>
      <Button variant="secondary" onClick={() => setPendingAction("reinvite")} disabled={busy !== null} loading={busy === "reinvite"}>
        Reinvite candidate
      </Button>

      <ConfirmDialog
        open={pendingAction !== null}
        title={ACTION_COPY[activeAction].title}
        message={ACTION_COPY[activeAction].message}
        confirmLabel={ACTION_COPY[activeAction].confirmLabel}
        danger={activeAction === "generate"}
        busy={busy === activeAction}
        onConfirm={() => pendingAction && run(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
```
Bug fix: both actions now require a `ConfirmDialog` confirmation before firing (previously a single click on either button fired the request immediately), and the old inline `message` paragraph is replaced with `useToast` success/error feedback.

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in browser**
Find a candidate whose interview is stuck (has an `interviewRow` but no `interviewReport` — e.g. a `terminated` status). Click "Generate report", confirm a confirm dialog appears with the generate copy; click Confirm, confirm a toast appears (success or error, matching the route's actual response) and the button returns to its normal state. Repeat for "Reinvite candidate", confirming its own confirm-dialog copy and toast message (`Reinvited (N sent).` on success).

- [ ] **Step 4: Commit**
```bash
git add app/admin/candidates/[userId]/InterviewRecoveryActions.tsx
git commit -m "fix(admin): require confirmation and surface toast feedback for interview recovery actions"
```

---

### Task 21: Full-suite verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything produced by Tasks 1-20.
- Produces: nothing.

- [ ] **Step 1: Full type-check**
Run: `npx tsc --noEmit`
Expected: no errors (exit code 0).

- [ ] **Step 2: Full build**
Run: `npm run build`
Expected: build completes successfully (`Compiled successfully`), no route errors for any `/admin/*` page.

- [ ] **Step 3: Run the full test suite**
Run: `npm test`
Expected: all existing test files pass, including `lib/__tests__/adminAuth.test.ts`, `lib/__tests__/adminCandidates.test.ts`, `lib/__tests__/adminCounselling.test.ts`, `lib/__tests__/adminPayments.test.ts` — none of them were modified by this plan, so none should have changed results.

- [ ] **Step 4: Full manual browser checklist**
Run `npm run dev`, log in as `roshan@merito.in`. At both **1440px** and **390px** widths, for every page below confirm: (a) no Navbar/Footer/Zoho chat widget renders, (b) the sidebar renders with the correct nav item highlighted active, (c) any table has visible column gaps and scrolls horizontally inside its own card rather than clipping the page, (d) any status column renders as a colored badge, (e) any destructive/state-changing action shows a confirm dialog before firing and a success/error toast after.
  - `/admin` — funnel overview
  - `/admin/candidates` — list; confirm any unlinked-user row shows "Not linked" instead of a dead link
  - `/admin/candidates/<userId>` — detail page for a candidate with fitment + interview + personality + references + at least one share link; confirm revoke/restore works with confirm+toast; confirm a candidate with a stuck interview shows generate/reinvite with confirm+toast
  - `/admin/payments` — confirm no glued column text anywhere, confirm the "None — good." empty state is green
  - `/admin/counselling` — list, both `?all=1` and default views
  - `/admin/counselling/<id>` — detail; confirm status select defaults to current status with Save disabled until a real change is picked, confirm confirm+toast flow
  - `/admin/extension` — confirm "No match" rows render as badges
  - `/admin/learned-skills`
  - Sidebar "Sign out" link — confirm it signs out and redirects to `/hub/login`, and that `/admin` then redirects to `/hub/login?next=/admin` for a signed-out visit

- [ ] **Step 5: Commit** (only if Steps 1-4 required any fix-up changes; otherwise skip — this task is verification-only)
```bash
git status
```
If the working tree is clean relative to the 20 commits already made in Tasks 1-20, no commit is needed here.

---

## Self-review

Walked the design spec section-by-section against the 21 tasks above:
- **Decision 1 (ChromeGate)** → Task 1. **Decision 2 (sidebar shell, flat 6-item nav)** → Tasks 9-10. **Decision 3 (admin-scoped components)** → all components created under `app/admin/_components/`. **Decision 4 (no new dependency)** → confirmed, every component hand-built with existing fonts/colors, no new `package.json` entries anywhere in this plan. **Decision 5 (logout link)** → Task 9. **Decision 6 (re-skin all 8 pages)** → Tasks 11-20 cover all 8 pages (`/admin`, `/admin/candidates` list + detail, `/admin/payments`, `/admin/counselling` list + detail, `/admin/extension`, `/admin/learned-skills`) plus both candidate-detail subcomponents.
- **All 6 "Concrete bugs fixed"** each map to an explicit task: null-userId dead link → Task 12; payments glued-text → Task 13 (root-caused to Task 6's cell padding); mobile clipping → Task 6's `overflow-x: auto` wrapper, exercised in every page task's manual-verify step; counselling `<select>` default bug → Task 15; silent revoke/status-change failures → Tasks 15, 19, 20; no active-nav-state/visual consistency → Task 9 (active state) + all re-skin tasks (consistency).
- **"Other gaps deferred to sub-project B"** — confirmed none of them appear as tasks (no search/filter/pagination wiring, no "last computed at" timestamp, no breadcrumb, no audit trail, no extension-list filtering beyond the empty-state treatment already called out as in-scope).
- **Error handling section** — `Toast` generic messages (no structured error parsing invented) confirmed in Tasks 15/19/20; `ConfirmDialog` required before every destructive/state-changing action confirmed for all three mutating flows (status change, revoke/restore, generate/reinvite).
- **Explicitly out of scope** — grepped every task for scope creep: no search/filter/sort/pagination *wiring* (Task 8 builds `Pagination` but wires it nowhere, matching the spec's own instruction), no audit trail, no tab restructure on the candidate drill-down (Task 18 explicitly keeps the single-column structure), no CSV export, no backend correctness fixes beyond the client-side no-op-Save guard in Task 15 (which required zero changes to `lib/adminCounselling.ts` or its API route), no `requireAdmin()`/auth changes, no new Supabase queries.
- **Testing section** — confirmed via Task 15's Test note (read `lib/__tests__/adminCounselling.test.ts` before writing that task) that no lib test needed changes; every other task ends in a manual-verify step, never an automated component test.

Grepped the draft for placeholder phrases ("TBD", "implement later", "add appropriate error handling", "similar to Task N", "etc." used as a stand-in for real content) — none found; every step either has complete code or an exact command + expected output.

Checked prop/type-name consistency end-to-end: `Table`/`TableHeadRow`/`TableRow`/`TableCell`/`TableEmptyRow` (Task 6) are imported with identical names and signatures in Tasks 11-14, 16-18. `Badge`/`BadgeVariant` (Task 4) identical in Tasks 12-14, 16, 18. `Button`'s `variant`/`loading` props (Task 3) identical in Tasks 7-9, 15, 19, 20. `ConfirmDialog`'s `open`/`title`/`message`/`confirmLabel`/`danger`/`busy`/`onConfirm`/`onCancel` (Task 7) identical in Tasks 15, 19, 20. `useToast().showToast(variant, text)` (Task 2) identical in Tasks 15, 19, 20. `ShareLinkRevokeToggle`'s `{ token, revoked }` and `InterviewRecoveryActions`'s `{ interviewId, status }` prop signatures are unchanged from their current form in both the producing tasks (19, 20) and the consuming call sites (Task 18's edit, and the untouched line in `app/admin/candidates/[userId]/page.tsx:114`), so task order between 18/19/20 doesn't matter.

One gap found and fixed during self-review: the original draft had `ConfirmDialog` conditionally *mounted* only while a `pendingAction` was set in Task 20's component, which would have made `busy={busy === pendingAction}` throw at the type level once `pendingAction` could be `null` inside the JSX-mounted branch. Fixed by always rendering `ConfirmDialog` with `open={pendingAction !== null}` and a non-null `activeAction` fallback for its copy lookup, matching the pattern that's now written into Task 20 above.
