import Image from "next/image";
import PrintControls, { PrintStamp } from "./print-controls";

export default function PrintDocument({ title, subtitle, sourceHref, landscape = false, children }: {
  title: string; subtitle?: string; sourceHref: string; landscape?: boolean; children: React.ReactNode;
}) {
  return (
    <main className={`print-preview${landscape ? " print-landscape" : ""}`}>
      <PrintControls sourceHref={sourceHref} landscape={landscape} />
      <article className="print-page" aria-label={title}>
        <table className="print-sheet" role="presentation">
          <thead><tr><td>
            <header className="print-header">
              <div><Image data-print-logo src="/elettra-logo.svg" alt="Elettra Group" width={214} height={35} unoptimized loading="eager" /><p className="print-company">Elettra S.r.l. · CRM</p></div>
              <div className="print-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}<PrintStamp initialDate={new Date().toISOString()} /></div>
            </header>
          </td></tr></thead>
          <tbody><tr><td className="print-body">{children}</td></tr></tbody>
        </table>
      </article>
    </main>
  );
}

export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="print-section"><h2>{title}</h2>{children}</section>;
}

export function PrintField({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="print-field"><dt>{label}</dt><dd>{children == null || children === "" ? "—" : children}</dd></div>;
}

export function PrintNotes() {
  return <section className="print-notes"><h2>Annotazioni</h2><div className="print-note-line" /><div className="print-note-line" /><div className="print-note-line" /><p>Compilato da ________________________________ &nbsp; Data __________________</p></section>;
}
