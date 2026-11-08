import { measurementReadiness } from "@/lib/readiness";

export function MeasurementReadiness(
  props: Parameters<typeof measurementReadiness>[0],
) {
  const facts = measurementReadiness(props);
  return (
    <dl className="measurement-readiness">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>
            <span className={fact.missing ? "chip chip-missing" : "chip"}>
              {fact.status}
            </span>
            <p className="fine">{fact.detail}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
