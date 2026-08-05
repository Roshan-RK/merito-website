import { listLearnedSkills } from "@/lib/adminLearnedSkills";

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

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Skill", "Sample job", "First seen"].map((label) => (
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
          {skills.map((s) => (
            <tr key={s.skill} style={{ borderBottom: "1px solid #eee" }}>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {s.skill}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {s.sampleJobTitle ?? <span className="text-[#9c9c9c]">—</span>}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(s.firstSeenAt)}
              </td>
            </tr>
          ))}
          {skills.length === 0 && (
            <tr>
              <td colSpan={3} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                No learned skills yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
