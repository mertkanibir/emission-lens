import { AppShell } from "@/components/AppShell";
import { CameraDetail, type CameraQuery } from "@/components/CameraDetail";
import { hrefWith, parseMode } from "@/lib/format";

export default async function CameraPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CameraQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const mode = parseMode(query.mode);
  return <AppShell mode={mode} section="camera" cameraId={id} modeHref={(next) => hrefWith(`/cameras/${id}`, { mode: next, reduce: query.reduce })}>
    <CameraDetail id={id} query={query} />
  </AppShell>;
}
