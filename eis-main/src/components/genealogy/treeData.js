export const MAX_VISIBLE_NODES = 120;

export function indexChildren(members) {
  const children = new Map();
  for (const member of members) {
    const parentId = member.placement_id || member.referrer_id;
    if (!parentId) continue;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(member);
  }
  return children;
}

// maintenanceStatus only needs the latest valid redemption for each member.
export function indexLatestCodes(codes) {
  const latest = new Map();
  for (const code of codes) {
    if (!code.is_used || !code.used_by_member_id || !code.used_at) continue;
    const usedAt = new Date(code.used_at).getTime();
    if (!Number.isFinite(usedAt)) continue;
    const previous = latest.get(code.used_by_member_id);
    if (!previous || usedAt > new Date(previous[0].used_at).getTime()) {
      latest.set(code.used_by_member_id, [code]);
    }
  }
  return latest;
}

// Breadth-first allocation keeps every nearby branch visible, with bounded DOM
// size even for very wide/deep networks. Re-rooting lets users explore the rest.
export function buildVisibleTree(member, childrenByParent, maxDepth, maxNodes = MAX_VISIBLE_NODES) {
  if (!member) return null;
  const root = { member, level: 0, children: [], hiddenCount: 0 };
  const queue = [root];
  const visited = new Set([member.id]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    const downlines = childrenByParent.get(node.member.id) || [];
    for (const child of downlines.slice(0, 8)) {
      // Invalid cyclic relationships must never recurse indefinitely.
      if (visited.has(child.id)) continue;
      if (node.level >= maxDepth || queue.length >= maxNodes) {
        node.hiddenCount++;
        continue;
      }
      visited.add(child.id);
      const next = { member: child, level: node.level + 1, children: [], hiddenCount: 0 };
      node.children.push(next);
      queue.push(next);
    }
  }
  return root;
}
