import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateGroup,
  canViewerSeePerson,
  parseRolesJson,
  primaryChurchRole,
  serializeRoles,
} from "./church-roles.js";

describe("church-roles", () => {
  it("parses legacy role and roles_json", () => {
    assert.deepEqual(parseRolesJson("[]", "admin"), ["admin"]);
    assert.deepEqual(parseRolesJson('["elder","deacon"]', "member"), ["elder", "deacon", "member"]);
    assert.equal(primaryChurchRole(["member", "elder"]), "elder");
    assert.equal(serializeRoles(["deacon", "deacon", "member"]), '["deacon","member"]');
  });

  it("gates group create to church admin / platform", () => {
    assert.equal(canCreateGroup(["member"], false), false);
    assert.equal(canCreateGroup(["admin"], false), true);
    assert.equal(canCreateGroup(["member"], true), true);
  });

  it("applies directory visibility rules", () => {
    const ancestors = new Map<string, string[]>([
      ["g1", ["g1", "dept1"]],
      ["dept1", ["dept1"]],
    ]);
    assert.equal(
      canViewerSeePerson({
        platformAdmin: true,
        viewerRoles: ["member"],
        viewerGroupIds: [],
        viewerLedGroupIds: [],
        viewerDepartmentRootIds: [],
        targetRoles: ["member"],
        targetGroupIds: ["g1"],
        targetIsGroupLeader: false,
        groupAncestorIds: ancestors,
      }),
      true,
    );
    assert.equal(
      canViewerSeePerson({
        platformAdmin: false,
        viewerRoles: ["member"],
        viewerGroupIds: ["g1"],
        viewerLedGroupIds: [],
        viewerDepartmentRootIds: [],
        targetRoles: ["member"],
        targetGroupIds: ["g1"],
        targetIsGroupLeader: false,
        groupAncestorIds: ancestors,
      }),
      true,
    );
    assert.equal(
      canViewerSeePerson({
        platformAdmin: false,
        viewerRoles: ["member"],
        viewerGroupIds: ["g1"],
        viewerLedGroupIds: [],
        viewerDepartmentRootIds: [],
        targetRoles: ["elder"],
        targetGroupIds: [],
        targetIsGroupLeader: false,
        groupAncestorIds: ancestors,
      }),
      true,
    );
    assert.equal(
      canViewerSeePerson({
        platformAdmin: false,
        viewerRoles: ["member"],
        viewerGroupIds: ["g1"],
        viewerLedGroupIds: [],
        viewerDepartmentRootIds: [],
        targetRoles: ["member"],
        targetGroupIds: ["other"],
        targetIsGroupLeader: false,
        groupAncestorIds: ancestors,
      }),
      false,
    );
    assert.equal(
      canViewerSeePerson({
        platformAdmin: false,
        viewerRoles: ["coworker"],
        viewerGroupIds: ["dept1"],
        viewerLedGroupIds: [],
        viewerDepartmentRootIds: ["dept1"],
        targetRoles: ["member"],
        targetGroupIds: ["g1"],
        targetIsGroupLeader: false,
        groupAncestorIds: ancestors,
      }),
      true,
    );
  });
});
