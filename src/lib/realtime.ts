import { io, type Socket } from 'socket.io-client';
import { config } from './config';
import { getAccessToken, refresh } from './session';

/**
 * Socket.IO (the backend's realtime service at `config.realtimeUrl`, a host of its own: the API
 * does not serve /socket.io). The handshake sends the current access token on every
 * (re)connect, so the server joins this phone to `user:{id}` (room reveals, the bell). Public rooms
 * (an event's slots and status, a match's results) are joined with `subscribe` and re-joined on every
 * connect. Events are hints only: screens re-read the API when one arrives.
 *
 * When the access token expires the server sends `auth.expired` and disconnects; socket.io does not
 * reconnect a server-side disconnect by itself, so the app refreshes the token and reconnects.
 */
let socket: Socket | null = null;
const rooms = new Set<string>();

export function getSocket(): Socket {
  if (socket) return socket;
  const s = io(config.realtimeUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() ?? undefined, audience: 'api' }),
  });
  s.on('connect', () => {
    for (const room of rooms) s.emit('subscribe', room);
  });
  const renew = async () => {
    await refresh().catch(() => null);
    if (!s.connected) s.connect();
  };
  s.on('auth.expired', () => void renew());
  s.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') void renew();
  });
  s.on('connect_error', (err: Error & { data?: { code?: string } }) => {
    if (err.data?.code === 'TOKEN_EXPIRED') void renew();
  });
  socket = s;
  return s;
}

/** Connect after sign-in (or as a guest for public rooms). */
export const connectRealtime = () => getSocket().connect();

/** After sign-in or sign-out: reconnect so the server sees the new identity. */
export function reconnectRealtime() {
  const s = getSocket();
  s.disconnect();
  s.connect();
}

/** Join a public room (`esports_tournament:<uuid>`, `esports_match:<uuid>`) for as long as a screen shows it. */
export function joinRoom(room: string): () => void {
  rooms.add(room);
  const s = getSocket();
  if (s.connected) s.emit('subscribe', room);
  return () => {
    rooms.delete(room);
    if (s.connected) s.emit('unsubscribe', room);
  };
}
