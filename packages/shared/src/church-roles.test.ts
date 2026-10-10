import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateGroup,
  canConveneCoworkerAssembly,
  canViewerSeePerson,
  deriveChurchRoleLayer,
  isCoworkerAssemblyMember,
  normalizeChurchRoles,
  parseRolesJson,
  primaryChurchRole,
  securityOfficerOfficeHint,
  serializeRoles,
} from "./church-roles.js";

describe("church-roles", () => {
  it("normalizes legacy admin to security_officer", () => {
    assert.deepEqual(parseRolesJson("[]", "admin"), ["security_officer"]);
    assert.deepEqual(normalizeChurchRoles(["admin", "elder"]), ["security_officer", "elder"]);
    assert.equal(serializeRoles(["admin", "member"]), '["security_officer","member"]');
  });

  it("parses roles_json and picks primary", () => {
    assert.deepEqual(parseRolesJson('["elder","deacon"]', "member"), ["elder", "deacon", "member"]);
    assert.equal(primaryChurchRole(["member", "elder"]), "elder");
    assert.equal(serializeRoles(["deacon", "deacon", "member"]), '["deacon","member"]');
  });

  it("gates group create to security officer / platform", () => {
    assert.equal(canCreateGroup(["member"], false), false);
    assert.equal(canCreateGroup(["admin"], false), true);
    assert.equal(canCreateGroup(["security_officer"], false), true);
    assert.equal(canCreateGroup(["member"], true), true);
  });

  it("derives church role layer", () => {
    assert.equal(deriveChurchRoleLayer(["security_officer"], false), "church_management");
    assert.equal(deriveChurchRoleLayer(["elder"], false), "church_coworker");
    assert.equal(deriveChurchRoleLayer(["member"], true), "group_coworker");
    assert.equal(deriveChurchRoleLayer(["member"], false), "group_member");
  });

  it("soft-hints security officer office", () => {
    assert.deepEqual(securityOfficerOfficeHint(["security_officer"]), {
      missingElder: true,
      suggestDeacon: true,
    });
    assert.deepEqual(securityOfficerOfficeHint(["security_officer", "elder"]), {
      missingElder: false,
      suggestDeacon: true,
    });
  });

  it("builds coworker assembly membership", () => {
    assert.equal(isCoworkerAssemblyMember({ roles: ["elder"], isGroupLeader: false }), true);
    assert.equal(isCoworkerAssemblyMember({ roles: ["deacon"], isGroupLeader: false }), true);
    assert.equal(isCoworkerAssemblyMember({ roles: ["member"], isGroupLeader: true }), true);
    assert.equal(isCoworkerAssemblyMember({ roles: ["coworker"], isGroupLeader: false }), true);
    assert.equal(
      isCoworkerAssemblyMember({
        roles: ["coworker"],
        isGroupLeader: false,
        includeChurchCoworkers: false,
      }),
      false,
    );
    assert.equal(isCoworkerAssemblyMember({ roles: ["member"], isGroupLeader: false }), false);
    assert.equal(canConveneCoworkerAssembly(["security_officer"], false), true);
    assert.equal(canConveneCoworkerAssembly(["elder"], false), true);
    assert.equal(canConveneCoworkerAssembly(["deacon"], false), false);
    assert.equal(canConveneCoworkerAssembly(["member"], true), true);
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
