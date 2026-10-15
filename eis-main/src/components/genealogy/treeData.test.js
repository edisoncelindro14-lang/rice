import test from "node:test";
import assert from "node:assert/strict";
import { buildVisibleTree, indexChildren, indexLatestCodes, MAX_VISIBLE_NODES } from "./treeData.js";
import { maintenanceStatus } from "../../lib/helpers.js";

function flatten(root) {
  const nodes = [root];
  for (let i = 0; i < nodes.length; i++) nodes.push(...nodes[i].children);
  return nodes;
}

test("large networks stay bounded and every member remains reachable by re-rooting", () => {
  const members = Array.from({ length: 20000 }, (_, i) => ({ id: `m${i}`, referrer_id: i ? `m${Math.floor((i - 1) / 8)}` : null }));
  const index = indexChildren(members);
  const tree = buildVisibleTree(members[0], index, Infinity);
  const nodes = flatten(tree);
  assert.equal(nodes.length, MAX_VISIBLE_NODES);
  assert.equal(nodes.filter(node => node.level <= 2).length, 73);
  assert.ok(nodes.some(node => node.hiddenCount > 0));
  const branch = nodes.find(node => node.hiddenCount > 0);
  assert.ok(buildVisibleTree(branch.member, index, Infinity).children.length > 0);
  assert.equal(buildVisibleTree(members.at(-1), index, Infinity).member.id, members.at(-1).id);
});

test("very deep networks stay bounded without exhausting the call stack", () => {
  const members = Array.from({ length: 20000 }, (_, i) => ({ id: `m${i}`, referrer_id: i ? `m${i - 1}` : null }));
  assert.equal(flatten(buildVisibleTree(members[0], indexChildren(members), Infinity)).length, MAX_VISIBLE_NODES);
});

test("self-reference and multi-member cycles terminate without duplicate nodes", () => {
  for (const members of [
    [{ id: "a", referrer_id: "a" }],
    [{ id: "a", referrer_id: "c" }, { id: "b", referrer_id: "a" }, { id: "c", referrer_id: "b" }],
  ]) {
    const nodes = flatten(buildVisibleTree(members[0], indexChildren(members), Infinity));
    assert.equal(nodes.length, members.length);
    assert.equal(new Set(nodes.map(node => node.member.id)).size, nodes.length);
  }
});

test("placement takes precedence over sponsor, and the eight-child and depth limits remain", () => {
  const root = { id: "root" };
  const members = [root, ...Array.from({ length: 9 }, (_, i) => ({ id: `child${i}`, placement_id: "root", referrer_id: "other" }))];
  const index = indexChildren(members);
  assert.equal(index.get("other"), undefined);
  assert.equal(buildVisibleTree(root, index, Infinity).children.length, 8);
  const tree = buildVisibleTree(root, index, 0);
  assert.equal(tree.children.length, 0);
  assert.equal(tree.hiddenCount, 8);
  assert.equal(buildVisibleTree(null, index, 5), null);
});

test("latest-code index preserves status and manual timer/override behavior", () => {
  const now = Date.now();
  const codes = [
    { is_used: true, used_by_member_id: "a", used_at: new Date(now - 60000).toISOString() },
    { is_used: true, used_by_member_id: "a", used_at: new Date(now - 120000).toISOString() },
    { is_used: false, used_by_member_id: "a", used_at: new Date(now).toISOString() },
    { is_used: true, used_by_member_id: "b", used_at: new Date(now - 86400000).toISOString() },
    { is_used: true, used_by_member_id: "b", used_at: null },
  ];
  const index = indexLatestCodes(codes);
  assert.equal(index.get("a").length, 1);
  for (const member of [
    { id: "a" }, { id: "b" }, { id: "c" }, { id: "a", maintenance_override: "red" },
    { id: "b", maintenance_override: "green" },
    { id: "c", maintenance_timer_seconds: 100, maintenance_timer_set_at: new Date(now).toISOString() },
  ]) {
    assert.deepEqual(maintenanceStatus(member, index.get(member.id) || []), maintenanceStatus(member, codes));
  }
});
