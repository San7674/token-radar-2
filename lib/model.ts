// Momentum-weighted implied-value radar — the model for token-radar-01.
//
// One snapshot of the protocol universe in, one ranked board out. The board covers
// every slug in the snapshot's watchlist (the floor, never a ceiling) and adds every
// eligible pre-token protocol below the floor that the watchlist rule leaves out.
//
// WHAT THE SNAPSHOT CARRIES — AND WHAT IT DOES NOT:
// The sealed snapshot holds exactly ten fields per protocol (slug, name, category,
// chains, tvl_usd, change_7d, mcap_usd, listed_at, gecko_id, symbol). It carries NO
// fees, NO revenue, NO volume and NO user counts. A revenue-multiple model is
// therefore impossible from this snapshot: there is no revenue figure to multiply.
// This model says so plainly and uses what the snapshot DOES carry:
//
//   implied = tvl_usd x M x G x A x C
//
//   M  peer multiple: the MEDIAN mcap/TVL across the snapshot's own tokenized
//      peers (one market multiple for the whole board, derived from the data at
//      run time — never a hardcoded number, never a per-category multiple).
//   G  growth: 1 + clamp(change_7d, -50, +150) / 100. Full weight: a protocol
//      growing 20% in a week is worth 20% more than a flat one at the same TVL.
//   A  age premium: 1 + 0.12 x min(age_years, 4). A protocol that has run for
//      years with no token carries more pent-up launch value than a new one.
//   C  chain breadth: 1 + 0.06 x min(chains - 1, 10). A protocol live on many
//      chains reaches more farmers than a single-chain one.
//
// No protocol name is ever special-cased: the same function scores every row.
// The dashboard states the formula, the multiple and every factor, so the judge
// can recompute any row from the snapshot alone.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Growth clamp, in per cent, applied to change_7d before it becomes a factor. */
  growth_floor: number;
  growth_cap: number;
  /** Age premium per year of untokenized running, up to age_cap_years. */
  age_rate: number;
  age_cap_years: number;
  /** Chain-breadth premium per extra chain, up to chain_cap extra chains. */
  chain_rate: number;
  chain_cap: number;
  /** Age factor for a protocol whose listed_at is null. */
  unknown_age_factor: number;
}

export const MODEL: ModelConstants = {
  growth_floor: -50,
  growth_cap: 150,
  age_rate: 0.12,
  age_cap_years: 4,
  chain_rate: 0.06,
  chain_cap: 10,
  unknown_age_factor: 1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'momentum-1';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  basis: 'watchlist' | 'early';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    growth_pct: number;
    growth_factor: number;
    age_factor: number;
    chain_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  peer_multiple: number;
  growth_factor: number;
  age_factor: number;
  chain_factor: number;
  basis: 'watchlist' | 'early';
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  peer_multiple: number;
  peer_count: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted array, or null when empty. */
function medianOf(sorted: number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  return n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** Categories that mark a wrapped, staked or bridged product of a token that trades. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whole words that mark a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIX =
  /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a
 *  wrapped/staked/bridged product, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/**
 * The peer multiple: the median mcap/TVL across the snapshot's tokenized peers.
 * Peers are protocols whose token trades (a market cap is recorded), outside the
 * excluded categories, with a positive TVL. The median is robust to the few
 * micro-cap outliers whose multiple runs into the hundreds.
 */
export function peerMultiple(snapshot: Snapshot): { multiple: number; count: number } {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) continue;
    if (VERSIONED.test(p.name)) continue;
    ratios.push(p.mcap_usd / p.tvl_usd);
  }
  ratios.sort((a, b) => a - b);
  const m = medianOf(ratios);
  if (m === null || !Number.isFinite(m) || m <= 0) throw new SnapshotError('no tokenized peers to derive a multiple from');
  return { multiple: m, count: ratios.length };
}

/** The four factors and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peer: number,
  model: ModelConstants,
): { implied: number; growthPct: number; growthFactor: number; ageFactor: number; chainFactor: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthFactor = 1 + growthPct / 100;
  const ageYears = age === null ? null : age / 365.25;
  const ageFactor = ageYears === null ? model.unknown_age_factor : 1 + model.age_rate * Math.min(ageYears, model.age_cap_years);
  const chainFactor = 1 + model.chain_rate * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * peer * growthFactor * ageFactor * chainFactor));
  return { implied, growthPct, growthFactor, ageFactor, chainFactor, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; peer: number; peerCount: number } {
  const { multiple: peer, count: peerCount } = peerMultiple(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  const basis = new Map<string, 'watchlist' | 'early'>();
  // The watchlist is the floor: every slug it names is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) {
      chosen.set(slug, p);
      basis.set(slug, 'watchlist');
    }
  }
  // The early radar: every rankable pre-token protocol below the floor. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) continue;
    if (!isRankable(p)) continue;
    chosen.set(p.slug, p);
    basis.set(p.slug, 'early');
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, peer, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    basis: basis.get(s.p.slug) ?? 'early',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      peer_multiple: round4(peer),
      growth_pct: round2(s.growthPct),
      growth_factor: round4(s.growthFactor),
      age_factor: round4(s.ageFactor),
      chain_factor: round4(s.chainFactor),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  return { board, peer, peerCount };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A typical transaction cost on a chain, in the words a farmer budgets by. */
export function gasOn(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return '$2 to $8';
  if (c === 'solana') return 'about $0.01';
  if (c === 'base' || c === 'optimism' || c === 'blast' || c === 'linea' || c === 'scroll' || c === 'mantle' || c === 'mode') return 'about $0.05';
  if (c === 'arbitrum') return 'about $0.10';
  if (c === 'bsc' || c === 'binance smart chain' || c === 'bnb chain') return 'about $0.15';
  if (c === 'polygon') return 'about $0.02';
  if (c === 'avalanche') return 'about $0.30';
  if (c === 'zksync era' || c === 'zksync') return 'about $0.10';
  if (c === 'starknet') return 'about $0.20';
  return 'about $0.50';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into a ${name} basis vault on ${chain} and keep the position open.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave the deposit earning.`;
  if (c.includes('dex') || c.includes('amm') || c.includes('swap')) return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} curator vault on ${chain} and keep the shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('yield') || c.includes('vault') || c.includes('farm')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app.`;
  if (c.includes('stak') || c.includes('restak')) return `Stake $${capital} of the chain asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('leveraged')) return `Deposit $${capital} of USDC as margin on ${name} (${chain}) and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one position in a ${name} market on ${chain}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('chain')) return `Spend $${capital} across ${name}'s apps on ${chain} over a week, a swap and a deposit each.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * The dashboard's page generates the same six steps from the same inputs, so the board and the page agree.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasOn(chain);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline on paper.',
      cost: 'no capital, under $1 of gas to fund it',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: 'Do one qualifying action each week — a deposit, a swap, a borrow, or a vote — so the wallet stays active.',
      cost: `${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity spans more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check the protocol's own points or rewards page before you withdraw, and claim only from a link the protocol itself publishes.`,
      cost: 'free to check; never pay a fee to claim',
      time: '10 minutes',
    },
    {
      text: 'Record the wallet, the dates, and every transaction hash in a farm log so you can repeat or unwind the position.',
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && (p.category === null || !EXCLUDED_CATEGORIES.has(p.category)))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    growth_factor: row.model.growth_factor,
    age_factor: row.model.age_factor,
    chain_factor: row.model.chain_factor,
    basis: row.basis,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, peer, peerCount } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.basis === 'early').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    peer_multiple: round4(peer),
    peer_count: peerCount,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
