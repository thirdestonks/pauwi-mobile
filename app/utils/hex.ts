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

// Flat-top hex layout (flat edge at top/bottom, points on the left/right) — matches
// the tile art style, which comes out flat-top from image generation.
export function axialToPixel(coord: AxialCoord, size: number): { x: number; y: number } {
  const x = size * (1.5 * coord.q)
  const y = size * ((Math.sqrt(3) / 2) * coord.q + Math.sqrt(3) * coord.r)
  return { x, y }
}

export function hexCorners(center: { x: number; y: number }, size: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    const x = center.x + size * Math.cos(angleRad)
    const y = center.y + size * Math.sin(angleRad)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return points.join(' ')
}
