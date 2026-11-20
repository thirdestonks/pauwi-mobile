export interface AxialCoord {
  q: number
  r: number
}

const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

export function keyToHex(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export function axialNeighbors(coord: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({ q: coord.q + dir.q, r: coord.r + dir.r }))
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export function hexesInRange(center: AxialCoord, radius: number): AxialCoord[] {
  const results: AxialCoord[] = []
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius)
    const rMax = Math.min(radius, -dq + radius)
    for (let dr = rMin; dr <= rMax; dr++) {
      results.push({ q: center.q + dq, r: center.r + dr })
    }
  }
  return results
}

