import type { MeasurementWindowView } from "@emission-lens/backend";
import { latestCompleteScenarioMinute } from "./scenario-window";

/** A recent supported minute is a dated default, never a fabricated whole-hour total. */
export function preferredInvestigationWindow<T extends {from?:string;to?:string;window?:string}>(query:T,measurement:MeasurementWindowView):T{
 if(query.from!==undefined||query.to!==undefined||query.window!==undefined||measurement.mode==="synthetic")return query;
 const candidate=latestCompleteScenarioMinute(measurement,measurement.to);
 if(!candidate||Date.parse(measurement.to)-Date.parse(candidate.to)>15*60000)return query;
 return {...query,from:candidate.from,to:candidate.to};
}
