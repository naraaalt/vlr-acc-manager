// Pure formatting helpers shared across panels.

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const DIVISION_BASE = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ASCENDANT', 'IMMORTAL', 'RADIANT'];
const DIVISION_COLORS = {
  IRON: '#8E979E',
  BRONZE: '#A2815A',
  SILVER: '#C9D1D9',
  GOLD: '#E3B341',
  PLATINUM: '#33BDB4',
  DIAMOND: '#6FAEE0',
  ASCENDANT: '#1FCE93',
  IMMORTAL: '#C94471',
  RADIANT: '#FFF582'
};
const DIVISION_ORDER = { IRON: 3, BRONZE: 6, SILVER: 9, GOLD: 12, PLATINUM: 15, DIAMOND: 18, ASCENDANT: 21, IMMORTAL: 24, RADIANT: 27 };
const TIER_UUID = '03621f52-342b-cf4e-4f86-9350a49c6d04'; // current episode competitivetiers uuid (valorant-api)

// "Ascendant 2" -> { division: 'ASCENDANT', tier: 22 }
export function parseRank(name) {
  if (!name) return null;
  const match = String(name).trim().toUpperCase().match(/^(IRON|BRONZE|SILVER|GOLD|PLATINUM|DIAMOND|ASCENDANT|IMMORTAL|RADIANT)\s*(\d)?$/);
  if (!match) return null;
  const division = match[1];
  const tier = division === 'RADIANT' ? 27 : DIVISION_ORDER[division] + Number(match[2] ?? 1) - 1;
  return { division, tier };
}

export function divisionColor(name) {
  const rank = parseRank(name);
  return rank ? DIVISION_COLORS[rank.division] : '#5C6E7E';
}

export function rankIconUrl(name, size = 'small') {
  const rank = parseRank(name);
  if (!rank) return null;
  return `https://media.valorant-api.com/competitivetiers/${TIER_UUID}/${rank.tier}/${size === 'large' ? 'largeicon' : 'smallicon'}.png`;
}

// "Reaver Vandal" -> "RIFLE"; "Singularity Knife" -> "MELEE"
const WEAPON_WORDS = {
  RIFLE: ['VANDAL', 'PHANTOM'],
  SMG: ['SPECTRE', 'STINGER'],
  SIDEARM: ['CLASSIC', 'GHOST', 'SHERIFF', 'FRENZY', 'SHORTY'],
  SNIPER: ['OPERATOR', 'MARSHAL', 'OUTLAW'],
  SHOTGUN: ['BUCKY', 'JUDGE'],
  HEAVY: ['ODIN', 'ARES'],
  MELEE: ['KNIFE', 'BLADE', 'AXE', 'SWORD', 'KATANA', 'NEEDLE', 'TALON', 'HAMMER', 'FISTS', 'FAN', 'SCYTHE', 'KUNAI', 'DAGGER', 'SPEAR', 'BAT', 'CLAW', 'GLOVES']
};
export function weaponCategory(skinName) {
  const words = String(skinName || '').toUpperCase().split(/\s+/);
  for (const word of words) {
    for (const [category, list] of Object.entries(WEAPON_WORDS)) {
      if (list.includes(word)) return category;
    }
  }
  return words.length ? words[words.length - 1] : 'WEAPON';
}

export function fmtCountdown(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function relativeTime(input) {
  if (!input) return '—';
  const then = new Date(input).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}
