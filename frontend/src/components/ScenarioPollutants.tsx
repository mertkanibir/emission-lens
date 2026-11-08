import {
  presentPollutantComparison,
  signedScenarioValue,
  scenarioValue,
  type PollutantComparisonInput,
} from "@/lib/scenario-presentation";

/** Both pollutants use the same backend cohort; hypothetical values stay separate. */
export function ScenarioPollutants({ rows }: { rows: PollutantComparisonInput[] }) {
  const pollutants = rows.map(presentPollutantComparison);
  return (
    <>
      <div className="table-scroll">
        <table className="data-table" aria-label="Hypothetical emissions comparison">
          <caption className="visually-hidden">
            Estimated tailpipe grams for the same completed-traversal cohort.
          </caption>
          <thead>
            <tr>
              <th>Pollutant</th>
              <th className="num">Baseline</th>
              <th className="num">Hypothetical scenario</th>
              <th className="num">Change · g</th>
              <th className="num">Change · %</th>
            </tr>
          </thead>
          <tbody>
            {pollutants.map((row) => (
              <tr key={row.pollutant}>
                <th scope="row">{row.label}</th>
                <td className="num"><span className={row.baseline === null ? "q-null" : "q"}>{scenarioValue(row.baseline, "g")}</span></td>
                <td className="num"><span className={row.scenario === null ? "q-null" : "q"}>{scenarioValue(row.scenario, "g")}</span></td>
                <td className="num">
                  <span className={row.changeGrams === null ? "q-null" : "q compare-delta"}>
                    {signedScenarioValue(row.changeGrams, "g")}
                  </span>
                </td>
                <td className="num">
                  <span className={row.changePercent === null ? "q-null" : "q compare-delta"}>
                    {signedScenarioValue(row.changePercent, "%")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">Change is scenario minus baseline. A positive value is an increase.</p>
      {pollutants.some((row) => row.baseline === 0) ? (
        <p className="fine">Percent change is undefined when the baseline is zero.</p>
      ) : null}
    </>
  );
}
