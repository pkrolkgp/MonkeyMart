// Pure deterministic helpers. No game network transport is implied.
export function chooseSuccessor(peers, departingId) {
  const eligible = peers.filter(p => p.id !== departingId && p.connected && p.canHost);
  eligible.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return eligible[0]?.id ?? null;
}
export function mergeRoomListings(lanRooms, internetRooms) {
  const rooms = new Map();
  for (const [scope, entries] of [['internet', internetRooms], ['lan', lanRooms]]) {
    for (const room of entries) {
      if (!room || typeof room.id !== 'string' || !room.id || typeof room.name !== 'string') continue;
      const old = rooms.get(room.id);
      rooms.set(room.id, { ...old, ...room, sources: [...new Set([...(old?.sources ?? []), scope])] });
    }
  }
  return [...rooms.values()].sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function acceptSnapshot(current, incoming) {
  if (!incoming || !Number.isSafeInteger(incoming.epoch) || !Number.isSafeInteger(incoming.revision) ||
      incoming.epoch < 0 || incoming.revision < 0 || typeof incoming.hostId !== 'string') return false;
  if (!current) return true;
  if (incoming.epoch < current.epoch) return false;
  if (incoming.epoch === current.epoch) return incoming.hostId === current.hostId && incoming.revision > current.revision;
  // A higher epoch requires external election/quorum validation, not just a number.
  return false;
}
