export function findPath(
  startX: number, startZ: number,
  endX: number, endZ: number,
  isBlocked: (x: number, z: number) => boolean,
  gridSize = 1.0,
  maxNodes = 1000
): {x: number, z: number}[] | null {
  const startGridX = Math.round(startX / gridSize);
  const startGridZ = Math.round(startZ / gridSize);
  const endGridX = Math.round(endX / gridSize);
  const endGridZ = Math.round(endZ / gridSize);

  // If already at destination grid, just return end point
  if (startGridX === endGridX && startGridZ === endGridZ) {
    return [{ x: endX, z: endZ }];
  }

  // Node representation: x, z, gCost, hCost, parent
  type Node = { x: number; z: number; g: number; h: number; parent: Node | null };
  const openList: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: startGridX,
    z: startGridZ,
    g: 0,
    h: Math.hypot(endGridX - startGridX, endGridZ - startGridZ),
    parent: null
  };
  openList.push(startNode);

  let nodesExplored = 0;

  while (openList.length > 0 && nodesExplored < maxNodes) {
    // Pop node with lowest fCost (g + h)
    let lowestIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].g + openList[i].h < openList[lowestIndex].g + openList[lowestIndex].h) {
        lowestIndex = i;
      }
    }
    const current = openList[lowestIndex];
    openList.splice(lowestIndex, 1);
    nodesExplored++;

    // Reached destination?
    if (current.x === endGridX && current.z === endGridZ) {
      const path: {x: number, z: number}[] = [];
      let curr: Node | null = current;
      while (curr && curr.parent) {
        path.push({ x: curr.x * gridSize, z: curr.z * gridSize });
        curr = curr.parent;
      }
      path.reverse();
      // Replace last node with exact end coordinate
      if (path.length > 0) {
        path[path.length - 1] = { x: endX, z: endZ };
      }
      return path;
    }

    closedSet.add(`${current.x},${current.z}`);

    // Neighbors (8 directions)
    const neighbors = [
      { dx: 0, dz: -1 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }, { dx: 1, dz: 0 },
      { dx: -1, dz: -1 }, { dx: 1, dz: -1 }, { dx: -1, dz: 1 }, { dx: 1, dz: 1 }
    ];

    for (const n of neighbors) {
      const nx = current.x + n.dx;
      const nz = current.z + n.dz;
      const key = `${nx},${nz}`;
      
      if (closedSet.has(key)) continue;

      // Check collision
      if (isBlocked(nx * gridSize, nz * gridSize)) {
        closedSet.add(key); // cache blocked
        continue;
      }

      // If diagonal, make sure we aren't cutting a solid corner
      if (n.dx !== 0 && n.dz !== 0) {
         if (isBlocked((current.x + n.dx) * gridSize, current.z * gridSize) ||
             isBlocked(current.x * gridSize, (current.z + n.dz) * gridSize)) {
            continue;
         }
      }

      const cost = Math.hypot(n.dx, n.dz);
      const g = current.g + cost;
      
      let neighborNode = openList.find(node => node.x === nx && node.z === nz);
      if (!neighborNode) {
        neighborNode = {
          x: nx, z: nz, g, h: Math.hypot(endGridX - nx, endGridZ - nz), parent: current
        };
        openList.push(neighborNode);
      } else if (g < neighborNode.g) {
        neighborNode.g = g;
        neighborNode.parent = current;
      }
    }
  }

  // No path found or max nodes reached
  return null;
}
