import assert from "node:assert/strict";
import test from "node:test";
import { cameraHeatData, emissionsCoreLayer, emissionsRingLayer } from "../src/lib/map-heat.ts";

const camera = {
  id: "222", longitude: -118.35286, latitude: 33.83135,
  emissions: { minute: "2026-11-08T13:25:00Z", co2_g: 17.3, nox_g: 0.003 },
};

test("map points preserve supported values including zero, while missing or invalid inputs remain absent", () => {
  const zero = { ...camera, id: "223", emissions: { ...camera.emissions, co2_g: 0 } };
  const data = cameraHeatData([
    camera, zero, { ...camera, id: "220", emissions: null },
    { ...camera, latitude: NaN },
    { ...camera, emissions: { ...camera.emissions, co2_g: -1 } },
    { ...camera, emissions: { ...camera.emissions, co2_g: Infinity } },
  ]);
  assert.equal(data.features.length, 2);
  assert.deepEqual(data.features[0].geometry.coordinates, [-118.35286, 33.83135]);
  assert.equal(data.features[0].properties?.co2_g, 17.3);
  assert.equal(data.features[1].properties?.co2_g, 0);
  assert.equal(data.features[0].properties?.minute, camera.emissions.minute);
  assert.deepEqual(emissionsCoreLayer.filter, [">", ["get", "co2_g"], 0]);
  assert.deepEqual(emissionsRingLayer.filter, [">", ["get", "co2_g"], 0]);
});
