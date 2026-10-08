import assert from "node:assert/strict";
import { test } from "node:test";
import { probeOpenE2eePqxdhWorkers } from "./opene2ee-pqxdh-probe.js";

test("OpenE2EE PQXDH key agreement works in Workers-shaped runtime", async () => {
  const probe = await probeOpenE2eePqxdhWorkers({ forceWorkersShape: true });
  assert.equal(probe.ok, true, probe.reason);
  assert.equal(probe.usedPQXDH, true);
  assert.ok(probe.sharedSecretBytes >= 32);
  assert.equal(probe.workersShaped, true);
  assert.match(probe.packageName, /open-e2ee/);
});
