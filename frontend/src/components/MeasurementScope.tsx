import type { measurementScope } from "@/lib/measurement-scope";

export function MeasurementScope({ scope, compact = false }: {
  scope: ReturnType<typeof measurementScope>;
  compact?: boolean;
}) {
  if (compact && !scope.known) return <p className="fine">{scope.title}.</p>;
  return (
    <div className="context-note" aria-label="Estimate scope and assumptions">
      <strong>{scope.title}</strong>
      <p>{scope.summary}</p>
      {!compact && scope.assumptions.length > 0 ? (
        <ul className="limits">
          {scope.assumptions.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
