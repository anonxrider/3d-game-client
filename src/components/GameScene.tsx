"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import Player, { clickTargetRef, travelDestinationRef, type Session } from "./Player";
import Interior from "./Interior";
import { getWeather } from "@/lib/weather";
import { getDayCycle } from "@/lib/day-night";
import DayNightCycle from "./Lighting";
import EnvironmentProps from "./Environment";
import Auth from "./Auth";
import { buildings, vehicleShopItems, getAreaName } from "./world";
import type { Snapshot } from "@/lib/multiplayer";
import TouchControls from "./TouchControls";
import { useMobileControls } from './useMobileControls';
import AdaptiveResolution from "./AdaptiveResolution";
import { getTerrainHeight, mountains } from "@/lib/terrain";
import { destinations } from "@/lib/destinations";
import Airport from "./Airport";
import { airport, inAirport } from "@/lib/airport";
import Railway from "./Railway";
import { getTrainState, nearestTrainIndex, railwayStations } from "@/lib/railway";
import type { Mesh } from "three";

type AuthUser = { name: string; email: string };

function loadStoredSession() {
  if (typeof window === 'undefined') return { user: null, token: null };
  const savedToken = localStorage.getItem('auth_token');
  const savedUser = localStorage.getItem('auth_user');
  if (!savedToken || !savedUser) return { user: null, token: null };
  try {
    return { user: JSON.parse(savedUser) as AuthUser, token: savedToken };
  } catch {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return { user: null, token: null };
  }
}

function RenderCoin({ coin }: { coin: import('@/lib/multiplayer').Coin }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 2;
      ref.current.rotation.x = Math.PI / 2;
    }
  });
  return (
    <group position={[coin.x, getTerrainHeight(coin.x, coin.z) + 0.5, coin.z]}>
    <mesh ref={ref}>
      <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={0.5} />
    </mesh>
    <Html position={[0, 0.85, 0]} center style={{ pointerEvents: "none" }}>
      <span style={{ color: "#fde68a", background: "rgba(35, 24, 5, 0.85)", border: "1px solid #fbbf24", borderRadius: 12, padding: "2px 7px", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>+{coin.value}</span>
    </Html>
    </group>
  );
}

function MiniMap({ snapshot }: { snapshot: Snapshot | null }) {
  const self = snapshot?.players.find(player => player.id === snapshot.self);
  if (!self || self.interior !== null) return null;
  const center = self.vehicle !== null ? snapshot?.vehicles[self.vehicle] ?? self : self;
  const range = 90;
  const toMap = (x: number, z: number) => ({
    left: `${50 + ((x - center.x) / range) * 50}%`,
    top: `${50 + ((z - center.z) / range) * 50}%`,
  });
  const nearbyBuildings = buildings
    .filter(building => Math.abs(building.x - center.x) <= range && Math.abs(building.z - center.z) <= range)
    .slice(0, 18);
  const nearbyVehicles = snapshot?.vehicles
    .map((vehicle, index) => ({ ...vehicle, index }))
    .filter(vehicle => Math.abs(vehicle.x - center.x) <= range && Math.abs(vehicle.z - center.z) <= range)
    .slice(0, 12) ?? [];

  return <div className="mini-map" aria-label="Nearby map">
    <div className="mini-map-title">{getAreaName(center.x, center.z)}</div>
    <div className="mini-map-grid" />
    {Math.abs(airport.x - center.x) <= range && Math.abs(airport.z - center.z) <= range && <span className="mini-map-pin mini-map-airport" style={toMap(airport.x, airport.z)} title={airport.name}>A</span>}
    {mountains.filter(m => Math.abs(m.x - center.x) <= range && Math.abs(m.z - center.z) <= range).map(m => (
      <span key={m.id} className="mini-map-pin mini-map-mountain" style={toMap(m.x, m.z)} title={m.name}>▲</span>
    ))}
    {railwayStations.filter(station => Math.abs(station.x - center.x) <= range && Math.abs(station.z - center.z) <= range).map(station => (
      <span key={station.id} className="mini-map-pin mini-map-station" style={toMap(station.x, station.z)} title={`${getAreaName(station.x, station.z)} Station`}>R</span>
    ))}
    {vehicleShopItems.map(item => (
      Math.abs(item.x - center.x) <= range && Math.abs(item.z - center.z) <= range
        ? <span key={item.kind} className="mini-map-pin mini-map-shop" style={toMap(item.x, item.z)} title={`${item.name} shop`}>S</span>
        : null
    ))}
    {nearbyBuildings.map(building => {
      const type = building.id.startsWith('hospital') ? 'hospital' : building.id === 'hotel' ? 'hotel' : 'home';
      return <span key={building.id} className={`mini-map-pin mini-map-${type}`} style={toMap(building.x, building.z)} title={building.name}>
        {type === 'hospital' ? 'H' : type === 'hotel' ? 'O' : ''}
      </span>;
    })}
    {nearbyVehicles.map(vehicle => (
      <span key={vehicle.index} className={`mini-map-pin mini-map-vehicle mini-map-${vehicle.kind}`} style={toMap(vehicle.x, vehicle.z)} title={vehicle.service === 'fire' ? 'Fire engine' : vehicle.service === 'ambulance' ? 'Ambulance' : vehicle.police ? 'Police car' : vehicle.kind}>
        {vehicle.service === 'ambulance' ? '+' : vehicle.service === 'fire' ? 'F' : vehicle.police ? 'P' : vehicle.kind === 'car' ? 'C' : vehicle.kind === 'cycle' ? 'Y' : 'B'}
      </span>
    ))}
    {snapshot?.players.filter(player => player.interior === null && player.id !== snapshot.self).map(player => (
      Math.abs(player.x - center.x) <= range && Math.abs(player.z - center.z) <= range
        ? <span key={player.id} className="mini-map-pin mini-map-player" style={toMap(player.x, player.z)} title={player.name} />
        : null
    ))}
    {snapshot?.npcs?.map(person => (
      Math.abs(person.x - center.x) <= range && Math.abs(person.z - center.z) <= range
        ? <span key={person.id} className="mini-map-pin mini-map-npc" style={toMap(person.x, person.z)} title={person.name} />
        : null
    ))}
    <span className="mini-map-pin mini-map-self" style={toMap(center.x, center.z)} />
    <div className="mini-map-legend">
      <span><i className="mini-map-airport" />Airport</span>
      <span><i className="mini-map-mountain" />Peak</span>
      <span><i className="mini-map-station" />Rail</span>
      <span><i className="mini-map-hospital" />Hospital</span>
      <span><i className="mini-map-shop" />Shop</span>
      <span><i className="mini-map-hotel" />Hotel</span>
    </div>
  </div>;
}

export default function GameScene() {
  const mobile = useMobileControls();
  const [storedSession] = useState(loadStoredSession);
  const [user, setUser] = useState<AuthUser | null>(storedSession.user);
  const [token, setToken] = useState<string | null>(storedSession.token);
  const [interior, setInterior] = useState<string | null>(null);
  const [status, setStatus] = useState("Walk up to a car or bike · E to ride");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [connection, setConnection] = useState('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [focusedAirport, setFocusedAirport] = useState(false);
  const [focusedTrain, setFocusedTrain] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const selfPlayer = snapshot?.players.find(p => p.id === snapshot.self);
  const playerCenter = selfPlayer?.vehicle != null
    ? snapshot?.vehicles[selfPlayer.vehicle] ?? selfPlayer
    : selfPlayer ?? { x: 0, z: 0 };
  const observingAirport = focusedAirport && interior === null;
  const observingRailway = !observingAirport && focusedTrain !== null && interior === null;
  const observingScene = observingAirport || observingRailway;
  const renderCenter = observingAirport ? airport : observingRailway ? { x: getTrainState(focusedTrain, (snapshot?.serverTime ?? 0) / 1000).x, z: 0 } : playerCenter;
  const chunkX = Math.round(renderCenter.x / 20) * 20;
  const chunkZ = Math.round(renderCenter.z / 20) * 20;
  const sceneryCenter = useMemo(() => ({ x: chunkX, z: chunkZ }), [chunkX, chunkZ]);
  const setTravelTarget = useCallback((point: { x: number; z: number }) => {
    if (!observingScene && !mobile) clickTargetRef.current = point;
  }, [observingScene, mobile]);

  const handleAuthenticated = (userData: AuthUser, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  useEffect(() => {
    if (!session) return;
    const leave = () => { void fetch('/api/world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ action: 'leave', room: session.room, token: session.token }) }).catch(() => {}); };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [session]);

  if (!user) return <Auth onAuthenticated={handleAuthenticated} />;

  if (!session) return <div className="multiplayer-lobby">
    <form className="lobby-card" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      const data = new FormData(event.currentTarget);
      const room = String(data.get('room')).trim().toLowerCase();
      try {
        const response = await fetch('/api/world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ action: 'join', room, name: user.name, authToken: token }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setSnapshot(result.snapshot); setSession({ room, ...result }); setCount(result.snapshot.players.length); setConnection('Connected');
        const url = new URL(window.location.href); url.searchParams.set('room', room); window.history.replaceState(null, '', url);
      } catch (error) { setError(error instanceof Error ? error.message : 'Unable to join'); }
      finally { setBusy(false); }
    }}>
      <span className="lobby-eyebrow">ETHERA / PLAY TOGETHER</span>
      <h2>Welcome, {user.name}</h2>
      <p>Explore, drive cars, and ride bikes together. Join the same room to meet your friends.</p>
      <label>Room code<input name="room" maxLength={32} pattern={"[a-zA-Z0-9\\-]+"} defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') || 'neighborhood' : 'neighborhood'} required /></label>
      <small>Use letters, numbers, or hyphens. Up to 12 players per room.</small>
      <button disabled={busy}>{busy ? 'Joining…' : 'Join world →'}</button>
      {error && <p role="alert" className="lobby-error">{error}</p>}
      <button type="button" onClick={() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', marginTop: '10px' }}>Sign Out</button>
    </form>
  </div>;
  const dayCycle = getDayCycle(snapshot?.serverTime ?? 0);
  const visibleCoins = snapshot?.coins?.filter(coin => Math.abs(coin.x - renderCenter.x) <= (mobile ? 60 : 100) && Math.abs(coin.z - renderCenter.z) <= (mobile ? 60 : 100)) ?? [];

  return (
    <>
    <div className={`multiplayer-bar ${menuOpen ? 'menu-open' : ''}`}>
      <div className="multiplayer-bar-header">
        <span className="status-text">
          <strong>{session.room}</strong> · 🌟 {snapshot?.players.find(p => p.id === snapshot.self)?.score || 0}
          <span className="status-details"> · {count}/12 players · {connection} · {dayCycle.label} {dayCycle.period} · {dayCycle.nextPeriod} in {dayCycle.countdown} · {getWeather(snapshot?.serverTime ?? 0).label}</span>
        </span>
        <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
      <div className="multiplayer-bar-controls">
        <label className="travel-menu">Travel to
          <select aria-label="Travel destination" value="" onChange={event => {
            if (!event.target.value) return;
            setFocusedTrain(null); setFocusedAirport(false);
            clickTargetRef.current = null;
            travelDestinationRef.current = event.target.value;
            setMenuOpen(false);
          }}>
            <option value="">Choose a place…</option>
            {destinations.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
          </select>
        </label>
        {interior === null && <button aria-pressed={observingRailway} onClick={() => { setFocusedAirport(false); setFocusedTrain(observingRailway ? null : nearestTrainIndex(playerCenter.x, (snapshot?.serverTime ?? 0) / 1000)); setMenuOpen(false); }}>{observingRailway ? 'Back to player' : 'View train'}</button>}
        {interior === null && <button aria-pressed={observingAirport} onClick={() => { setFocusedTrain(null); setFocusedAirport(!observingAirport); setMenuOpen(false); }}>{observingAirport ? 'Back to player' : 'View airport'}</button>}
        <button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setConnection('Copy the room URL from your address bar'); } }}>{copied ? 'Link copied' : 'Copy invite'}</button>
        <button onClick={() => { void fetch('/api/world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ action: 'leave', room: session.room, token: session.token }) }).catch(() => {}); setSession(null); setInterior(null); setCopied(false); setFocusedTrain(null); setFocusedAirport(false); }}>Leave</button>
      </div>
    </div>
    <div className="interaction-prompt" role="status">
      <strong className="current-place">{selfPlayer?.station ? destinations.find(d => d.id === selfPlayer.station)?.name : interior ? buildings.find(b => b.id === interior)?.name : (inAirport(renderCenter.x, renderCenter.z) ? airport.name : mountains.find(m => Math.abs(renderCenter.x - m.x) + Math.abs(renderCenter.z - m.z) <= m.radius)?.name ?? getAreaName(renderCenter.x, renderCenter.z))}</strong>
      {observingAirport ? 'Airport camera · Watch departures and landings · Back to player to explore' : observingRailway ? 'Train camera · Select Back to player to resume exploring' : status}
    </div>
    <MiniMap snapshot={snapshot} />
    {!observingScene && <TouchControls driving={selfPlayer?.vehicle != null} />}
    
    {(() => {
      const self = snapshot?.players.find(p => p.id === snapshot.self);
      const vehicleIndex = self?.vehicle;
      const speed = vehicleIndex === undefined || vehicleIndex === null ? null : snapshot?.vehicles[vehicleIndex]?.speed;
      if (speed === null || speed === undefined) return null;
      return (
      <div className="speedometer">
        {Math.abs(Math.round(speed * 3.6))} <span style={{ fontSize: '14px', color: '#94a3b8' }}>KM/H</span>
      </div>
      );
    })()}

    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      fallback={<div role="alert">This device cannot start the 3D renderer. Try a browser with WebGL enabled.</div>}
      camera={{ position: [0, 5, 10], fov: 50, near: 0.5, far: 600 }}
      style={{ width: "100%", height: "100%" }}
    >
      <fog attach="fog" args={["#bfd6e1", observingAirport ? 1200 : mobile ? 55 : 90, observingAirport ? 2000 : mobile ? 110 : 260]} />
      <AdaptiveResolution />
      <DayNightCycle serverTime={snapshot?.serverTime} interior={interior !== null} />

      {interior === null ? <>
      {/* The Infinite Land */}
      <mesh receiveShadow position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => {
        setTravelTarget({ x: e.point.x, z: e.point.z });
      }}>
        <planeGeometry args={[20000, 20000]} />
        <meshStandardMaterial color="#60855a" />
      </mesh>

      {/* Environment Props (Trees, Roads, Cars) */}
      <EnvironmentProps mobile={mobile} center={sceneryCenter} onTravelClick={setTravelTarget} />
      <Airport focused={observingAirport} serverTime={snapshot?.serverTime} />
      <Railway center={sceneryCenter} serverTime={snapshot?.serverTime} focusedTrain={observingRailway ? focusedTrain : null} />

      {/* Floating Coins */}
      {visibleCoins.map(coin => (
        <RenderCoin key={coin.id} coin={coin} />
      ))}
      </> : <Interior id={interior} />}

      {/* The Player */}
      <Player session={session} observingRailway={observingScene} onSnapshot={setSnapshot} onStatus={setStatus} onConnection={setConnection} onCount={setCount} onInterior={setInterior} />
    </Canvas>
    </>
  );
}
