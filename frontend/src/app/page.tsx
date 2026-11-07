import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import type { Mode } from "@emission-lens/contracts";
import Link from "next/link";
import { CameraMap } from "@/components/CameraMap";
import { formatQuantity, modeLabel, parseMode } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const mode = parseMode((await searchParams).mode);
  const cameras = listCameras();
  const cards = cameras.map((camera) => {
    const status = get_camera_status(camera.id, mode);
    const traffic = get_traffic_window({ cameraId: camera.id, mode });
    const emissions = get_emissions_window({ cameraId: camera.id, mode });
    return { camera, status, traffic, emissions };
  });

  return (
    <main>
      <p className="lede">
        Estimated tailpipe CO₂ and NOₓ for four public intersection cameras. Figures are modeled
        estimates when a factor table is loaded. They are not measured concentrations.
      </p>
      <ModeLinks mode={mode} path="/" />
      <ModeBanner mode={mode} />
      <div className="layout">
        <CameraMap
          cameras={cards.map((card) => ({
            id: card.camera.id,
            name: card.camera.name,
            latitude: card.camera.latitude,
            longitude: card.camera.longitude,
            stateLabel: card.status.displayed_state,
            href: `/cameras/${card.camera.id}?mode=${mode}`,
          }))}
        />
        <div className="camera-list">
          {cards.map((card) => (
            <article className="card" key={card.camera.id}>
              <div className="meta">
                <h2>
                  <Link href={`/cameras/${card.camera.id}?mode=${mode}`}>{card.camera.name}</Link>
                </h2>
                <span className={`status status-${card.status.displayed_state}`}>
                  {card.status.displayed_state}
                </span>
              </div>
              <p>Camera {card.camera.id}</p>
              <dl>
                <div>
                  <dt>Crossings</dt>
                  <dd>{formatQuantity(card.traffic.totals.count, "")}</dd>
                </div>
                <div>
                  <dt>Queue count</dt>
                  <dd>{formatQuantity(card.traffic.queue_count, "vehicles")}</dd>
                </div>
                <div>
                  <dt>Estimated CO₂</dt>
                  <dd>{formatQuantity(card.emissions.estimate_g_by_pollutant.co2, "g")}</dd>
                </div>
                <div>
                  <dt>Estimated NOₓ</dt>
                  <dd>{formatQuantity(card.emissions.estimate_g_by_pollutant.nox, "g")}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ModeLinks({ mode, path }: { mode: Mode; path: string }) {
  const options: Mode[] = ["live", "replay", "synthetic"];
  return (
    <nav className="mode-switch" aria-label="Data mode">
      {options.map((option) => (
        <Link
          key={option}
          href={option === "live" ? path : `${path}?mode=${option}`}
          aria-current={option === mode ? "page" : undefined}
        >
          {modeLabel(option)}
        </Link>
      ))}
    </nav>
  );
}

export function ModeBanner({ mode }: { mode: Mode }) {
  if (mode === "live") {
    return (
      <p className="banner">
        <strong>Live.</strong> No worker heartbeat is connected, so these cameras stay offline.
        Empty estimates are unavailable, not zero.
      </p>
    );
  }
  if (mode === "replay") {
    return (
      <p className="banner">
        <strong>Replay.</strong> No clip is loaded. Replay is kept out of live totals.
      </p>
    );
  }
  return (
    <p className="banner">
      <strong>Synthetic sample.</strong> One labeled minute for camera 222 exercises the dashboard.
      It is not a field measurement and it is not included in live totals.
    </p>
  );
}
