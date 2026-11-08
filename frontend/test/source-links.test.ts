import assert from "node:assert/strict";
import test from "node:test";
import { sourceLinks } from "../src/lib/source-links.ts";

test("an absent web-build receipt offers the project repository without a running-version claim", () => {
  const links = sourceLinks();
  assert.equal(links.source, "https://github.com/mertkanibir/emission-lens");
  assert.equal(links.sourceLabel, "Source repository");
  assert.match(links.licence, /\/blob\/main\/LICENSE$/);
  assert.match(links.notice, /\/blob\/main\/NOTICE$/);
  assert.match(links.availability, /\/blob\/main\/release\/SOURCE-AVAILABILITY\.md$/);
});

test("a full immutable web revision produces only the matching source tree", () => {
  const revision = "7b5818f923dab43815ffd7f74fb2ec9c9ee6c5d3";
  assert.equal(sourceLinks(revision).source, `https://github.com/mertkanibir/emission-lens/tree/${revision}`);
  assert.equal(sourceLinks(revision.toUpperCase()).source, sourceLinks(revision).source);
  assert.equal(sourceLinks(revision).sourceLabel, "Source for this build");
});

test("branch names, abbreviated commits, paths and arbitrary environment text cannot become a build source claim", () => {
  for (const revision of ["", "main", "7b5818f", "../private", "https://example.com", "a".repeat(39), "a".repeat(41), "a".repeat(40) + "\n", " " + "a".repeat(40)]) {
    assert.equal(sourceLinks(revision).sourceLabel, "Source repository");
    assert.equal(sourceLinks(revision).source, sourceLinks().source);
  }
});
