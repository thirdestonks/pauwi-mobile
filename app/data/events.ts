// Item-based dilemma events for 'event' tiles. Each one is a small trade: something from
// the field bag against Hope, Dread relief, or nothing but the road. The radio-style
// flavor card ("A Voice on the Radio") stays in TileCard as the fallback so SIGNAL tiles
// always have something human in them.
import { pickWeighted } from './combat'

export interface EventOutcome {
  text: string
  hope?: number
  dreadRelief?: number
}

export interface EventChoice {
  label: string
  /** Item id the choice consumes from the field bag. Without it, the choice is locked. */
  requires?: string
  outcome?: EventOutcome
}

export interface EventDef {
  id: string
  title: string
  icon: string
  accent: string
  flavor: string
  choices: EventChoice[]
}

export const EVENTS: EventDef[] = [
  {
    id: 'gate-toll',
    title: 'Gate Toll',
    icon: '🚧',
    accent: '#F0A63C',
    flavor:
      "A barricade of tables and chain-link. The men behind it aren't dead yet — and they're charging passage. One clean bottle of water and you walk through without trouble.",
    choices: [
      {
        label: 'Pay the toll — 1 Water',
        requires: 'water',
        outcome: {
          text: "They wave you through and point you down a street the fog hasn't touched. Worth it.",
          hope: 10,
        },
      },
      {
        label: 'Keep your water — walk away',
        outcome: {
          text: 'You back off before anyone reaches for something sharp. The long way around it is.',
        },
      },
    ],
  },
  {
    id: 'barter',
    title: 'Road Barter',
    icon: '🤝',
    accent: '#2E86AB',
    flavor:
      "A trader has set up shop on a jeepney roof, two guards with baseball bats below. He's got batteries. He wants food. Everything costs something now.",
    choices: [
      {
        label: 'Trade 1 Canned Food → Battery',
        requires: 'canned-food',
        outcome: {
          text: 'The battery is warm from his jacket pocket and takes a charge like a dream. Fair trade.',
          hope: 4,
        },
      },
      {
        label: 'Hold your supplies',
        outcome: { text: 'He shrugs and moves on. "Your funeral, pre." The jeepney rattles away.' },
      },
    ],
  },
  {
    id: 'stranger',
    title: 'Injured Stranger',
    icon: '🩸',
    accent: '#D94B3B',
    flavor:
      'She\'s propped against a barangay outpost post, shin wrapped in a filthy shirt. "I can\'t pay you," she says, "but I can point you past the crowd on Rizal." She looks like she\'s telling the truth.',
    choices: [
      {
        label: 'Spend 1 Medicine on her',
        requires: 'medicine',
        outcome: {
          text: 'The dressing holds. She tells you which alleys are clear, then hobbles off alive.',
          hope: 15,
          dreadRelief: 10,
        },
      },
      {
        label: 'Leave her — supplies are survival',
        outcome: { text: "You don't look back. Her eyes follow you anyway.", hope: -5 },
      },
    ],
  },
]

/** Rolled once per event tile and stored on it, the way encounters are. */
export function rollEventId(): string {
  return pickWeighted(EVENTS.map((event) => [event.id, 1] as [string, number]))
}
