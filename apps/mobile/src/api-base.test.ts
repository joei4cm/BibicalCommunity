import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getApiBase, hydrateApiBase, setApiBase } from "./api";

describe("api base runtime override", () => {
  it("setApiBase normalizes trailing slash and persists", async () => {
    await setApiBase("https://api.example.com/");
    assert.equal(getApiBase(), "https://api.example.com");
    await hydrateApiBase();
    assert.equal(getApiBase(), "https://api.example.com");
  });
});
