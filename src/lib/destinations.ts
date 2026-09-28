import { airport } from './airport';
import { railwayStations } from './railway';
import { mountains } from './terrain';

export const destinations = [
  { id: 'town', name: 'Ethera Central', x: 0, z: 0, station: null as string | null },
  { id: 'airport', name: airport.name, x: airport.x, z: airport.z - 52, station: null },
  ...railwayStations.map(station => ({ id: station.id, name: station.x === 0 ? 'Central Railway Station' : `Railway Station ${station.x < 0 ? 'West' : 'East'} ${Math.abs(station.x) / 400}`, x: station.x, z: 4.5, station: station.id })),
  ...mountains.map(m => ({ id: m.id, name: `${m.name} trailhead`, x: m.x, z: m.z + m.radius + 8, station: null })),
];
