// The run's named shelters, in no particular order — board.ts shuffles the five
// waypoints per run. Nida's is always the start; Tutuban is always the end.
export interface ShelterDef {
  name: string
  flavor: string
}

export const TUTUBAN_NAME = 'Tutuban Station'

export const SHELTER_DEFS: ShelterDef[] = [
  { name: "Nida's Sari-Sari Store", flavor: '· OPEN 24 HRS · NO CREDIT ·' },
  { name: "Mang Ben's Jeepney Garage", flavor: '· OPEN BAY 2 · TOOLS FOR SALE ·' },
  { name: "Aling Rosa's Carinderia", flavor: '· RICE POT STILL WARM · PALARAN ·' },
  { name: 'San Roque Chapel', flavor: '· QUIET PLEASE · CANDLES 5 PESOS ·' },
  { name: 'The Botika on Antipolo St.', flavor: '· NO RX NEEDED · LIMIT 2 PER HEAD ·' },
  { name: 'Barangay 20 Evacuation Post', flavor: '· ASSIGNED SHELTER · KEEP CLEAN ·' },
]
