export default function AvvisiAssegnazioni({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return <div role="status" aria-label="Impegni contemporanei" className="w-full rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm text-ink">
    <p className="font-semibold">Impegni contemporanei</p>
    <ul className="mt-2 space-y-1">{warnings.map((warning, index) => <li key={`${index}:${warning}`} className="break-words">{warning}</li>)}</ul>
    <p className="mt-2 text-ink-soft">Le assegnazioni sono consentite e restano salvate. L’avviso serve a coordinare gli impegni; i periodi senza date sono considerati aperti.</p>
  </div>;
}
