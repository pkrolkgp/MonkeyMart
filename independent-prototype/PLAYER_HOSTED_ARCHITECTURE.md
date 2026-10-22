# Player-hosted multiplayer architecture (independent prototype)

Status: UDP LAN announcements are now emitted by the standalone Node game server, but the browser still has no LAN room browser and host migration is not implemented.

## Responsibilities
- **Game host:** the creator runs the authoritative simulation and owns a versioned state snapshot. Other players connect directly to that host.
- **Directory/lobby:** optional public service lists sessions and participants, provides signaling only; it must never decide inventory, movement or money.
- **LAN:** each native game process advertises its own room with UDP multicast/broadcast discovery, independent of the directory. Browser tabs cannot perform raw UDP discovery, so a native companion or desktop build is required.
- **All visible sessions:** aggregate LAN discovery and public directory listings, de-duplicate by globally unique room ID, and mark scope (LAN/internet). This cannot guarantee visibility of hosts behind NAT or isolated Wi-Fi networks.
- **Host departure:** each peer holds recent versioned snapshots. A graceful host departure transfers the latest snapshot and lease to the deterministic successor before the old host closes. For an abrupt crash, peers elect the same eligible successor by ordered peer IDs and reject stale state epochs. The new host opens its listening socket and broadcasts the new endpoint.
- **Split-brain safety:** epoch and revision alone are not sufficient for partition-safe consensus. During ambiguous partitions, pause authoritative mutations until peers agree on a single host; never independently accept transactions in both partitions.
- **Internet:** direct peer transport needs signaling and NAT traversal (ICE/STUN); TURN relay may be necessary. A pure static website cannot promise universal direct connections.

## Current implementation boundary
The existing `independent-prototype/server.mjs` remains a dedicated authoritative WebSocket server. It is **not** player-hosted and is not converted by this documentation. The LAN helper below demonstrates discovery for a native Node.js process; it is not a finished matchmaking layer.

## Acceptance criteria for completion
1. Two separate Mac devices discover and join a room on the same LAN with the directory offline.
2. Browser/native clients continue game state after graceful host exit; also exercise abrupt termination.
3. Reconnect and duplicate/out-of-order messages cannot duplicate purchases or sales.
4. Public directory lists only opted-in rooms and does not receive authoritative game state.
5. CI includes integration tests for host migration, LAN discovery and disconnect/reconnect.

## LAN discovery now implemented (partial)
Starting `node server.mjs` announces the local room via UDP multicast 239.255.42.87:41287 (TTL 1). `lan-discovery.mjs` can receive room advertisements without contacting the internet. On another Mac, a native Node process must use `createLanDiscovery({onRooms})` to show discovered rooms. The existing browser client still needs a room-selection UI or native companion. Multicast may be blocked by guest Wi-Fi, AP isolation, firewalls or routers; discovery is best-effort, not a guarantee of every room. This is not host migration: the Node server is still authoritative and exiting it ends the game.
