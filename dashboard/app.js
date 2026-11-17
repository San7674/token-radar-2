// Momentum-weighted implied-value radar — the dashboard's page.
// Reads window.RADAR (data.js, written by main.ts from the same board) and renders
// the board, the detail view and the live-token view. No fetch, no network: every
// address the page names is a fragment of its own URL.
//
// The farm-plan generator below is the same six steps lib/model.ts writes into
// board.json, from the same inputs (category, chains, TVL, age), so the board and
// the page always agree on a protocol's plan.

const D = window.RADAR;

/** Whole dollars, short: $982M, $14.2M, $850K. */
function money(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
  return '$' + Math.round(n);
}

/** A per-cent change with a sign, or an em dash when unreported. */
function pct(v) {
  if (v === null || v === undefined) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}

/** Age in years from days, or an em dash. */
function ageText(days) {
  if (days === null || days === undefined) return '—';
  const y = days / 365.25;
  return y >= 1 ? y.toFixed(1) + 'y' : Math.round(days) + 'd';
}

/* ---- farm plans: the same generator lib/model.ts uses for board.json ---- */

function gasOn(chain) {
  const c = String(chain).toLowerCase();
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

function capitalFor(row) {
  if (row.tvl_usd >= 1000000000) return 250;
  if (row.tvl_usd >= 100000000) return 150;
  if (row.tvl_usd >= 50000000) return 100;
  return 50;
}

function holdDaysFor(age) {
  if (age === null || age === undefined) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(row, capital, chain) {
  const c = (row.category || '').toLowerCase();
  const name = row.name;
  if (c.includes('basis')) return 'Deposit $' + capital + ' of USDC into a ' + name + ' basis vault on ' + chain + ' and keep the position open.';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Lend $' + capital + ' of USDC on ' + name + ' (' + chain + ') and leave the deposit earning.';
  if (c.includes('dex') || c.includes('amm') || c.includes('swap')) return 'Add $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'Deposit $' + capital + ' into a ' + name + ' curator vault on ' + chain + ' and keep the shares.';
  if (c.includes('rwa')) return 'Mint $' + capital + ' of ' + name + '\'s yield-bearing asset on ' + chain + ' and hold it.';
  if (c.includes('yield') || c.includes('vault') || c.includes('farm')) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
  if (c.includes('bridge')) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app.';
  if (c.includes('stak') || c.includes('restak')) return 'Stake $' + capital + ' of the chain asset through ' + name + ' on ' + chain + ' and keep the receipt token.';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('leveraged')) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' (' + chain + ') and open one small hedged position.';
  if (c.includes('prediction')) return 'Fund $' + capital + ' and place one position in a ' + name + ' market on ' + chain + '.';
  if (c.includes('insurance')) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
  if (c.includes('stable')) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
  if (c.includes('chain')) return 'Spend $' + capital + ' across ' + name + '\'s apps on ' + chain + ' over a week, a swap and a deposit each.';
  return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
}

function farmSteps(row) {
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'its main chain';
  const capital = capitalFor(row);
  const hold = holdDaysFor(row.age_days);
  const gas = gasOn(chain);
  const action = actionFor(row, capital, chain);
  const steps = [
    { text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline on paper.', cost: 'no capital, under $1 of gas to fund it', time: '5 minutes' },
    { text: action, cost: '$' + capital + ' of capital and ' + gas + ' of gas', time: '15 minutes to set up' },
    { text: 'Do one qualifying action each week — a deposit, a swap, a borrow, or a vote — so the wallet stays active.', cost: gas + ' of gas a week', time: '10 minutes a week' },
    { text: 'Hold the position for at least ' + hold + ' days so the activity spans more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
    { text: 'Check the protocol\'s own points or rewards page before you withdraw, and claim only from a link the protocol itself publishes.', cost: 'free to check; never pay a fee to claim', time: '10 minutes' },
    { text: 'Record the wallet, the dates, and every transaction hash in a farm log so you can repeat or unwind the position.', cost: 'nothing but the log', time: '5 minutes' },
  ];
  return steps.map(function (s) {
    let out = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
    if (out.length > 600) out = out.slice(0, 596) + '...';
    if (out.length < 20) out = out + ' Hold the position and check the protocol\u2019s own page.';
    return out;
  });
}

/* ---- rendering ---- */

const $ = function (id) { return document.getElementById(id); };
const esc = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

let sortKey = 'rank';
let sortDir = 1;
const DEFAULT_DIR = { rank: 1, implied: -1, tvl: -1, growth: -1, age: -1, name: 1, category: 1 };

function sortedRows(rows) {
  const key = sortKey;
  const arr = rows.slice();
  const val = function (r) {
    if (key === 'rank') return r.rank;
    if (key === 'implied') return r.implied_value_usd;
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
    if (key === 'age') return r.age_days === null ? -1 : r.age_days;
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'category') return (r.category || '').toLowerCase();
    return r.rank;
  };
  arr.sort(function (a, b) {
    const va = val(a), vb = val(b);
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return (a.rank - b.rank) * sortDir;
  });
  return arr;
}

function currentRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const basis = $('basis').value;
  const growers = $('growers').checked;
  return D.rows.filter(function (r) {
    if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
    if (cat && r.category !== cat) return false;
    if (basis && r.basis !== basis) return false;
    if (growers && !(r.change_7d !== null && r.change_7d > 0)) return false;
    return true;
  });
}

function renderBoard() {
  const rows = sortedRows(currentRows());
  $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols shown';
  $('rows').innerHTML = rows.map(function (r) {
    const chg = r.change_7d;
    const cls = chg === null ? '' : (chg > 0 ? 'pos' : (chg < 0 ? 'neg' : ''));
    return '<tr data-slug="' + esc(r.slug) + '">' +
      '<td>' + r.rank + '</td>' +
      '<td><strong>' + esc(r.name) + '</strong><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + cls + '">' + pct(chg) + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
      '<td><span class="badge ' + r.basis + '">' + (r.basis === 'watchlist' ? 'Watchlist' : 'Early') + '</span></td>' +
      '</tr>';
  }).join('');
}

function showDetail(slug) {
  const r = D.rows.find(function (x) { return x.slug === slug; });
  const box = $('detail');
  if (!r) { box.hidden = true; box.innerHTML = ''; return; }
  const steps = farmSteps(r);
  const g = r.change_7d === null ? 0 : Math.min(150, Math.max(-50, r.change_7d));
  box.innerHTML =
    '<h2>#' + r.rank + ' — ' + esc(r.name) + '</h2>' +
    '<p class="meta">' + esc(r.category || 'Uncategorised') + ' &middot; ' + esc(r.chains.join(', ') || 'no chain listed') +
    ' &middot; TVL ' + money(r.tvl_usd) + ' &middot; 7d ' + pct(r.change_7d) + ' &middot; age ' + ageText(r.age_days) +
    ' &middot; ' + (r.basis === 'watchlist' ? 'Watchlist' : 'Early find') + '</p>' +
    '<h3>Why it ranks here</h3>' +
    '<dl class="factors">' +
    '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
    '<div><dt>Peer multiple (M)</dt><dd>' + r.peer_multiple.toFixed(3) + '<small>median mcap/TVL, ' + D.peer_count + ' peers</small></dd></div>' +
    '<div><dt>Growth (G)</dt><dd>' + r.growth_factor.toFixed(2) + '×<small>7d ' + pct(g) + '</small></dd></div>' +
    '<div><dt>Age (A)</dt><dd>' + r.age_factor.toFixed(2) + '×<small>' + ageText(r.age_days) + ' with no token</small></dd></div>' +
    '<div><dt>Chains (C)</dt><dd>' + r.chain_factor.toFixed(2) + '×<small>' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</small></dd></div>' +
    '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '<small>TVL × M × G × A × C</small></dd></div>' +
    '</dl>' +
    '<h3>Farm plan — six steps</h3>' +
    '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
    '<p class="muted">Implied values are this entry\u2019s own claim, never a prediction of whether or when a token is issued. A protocol is called pre-token because its DefiLlama record carries no token.</p>';
  box.hidden = false;
  document.querySelectorAll('#rows tr.sel').forEach(function (tr) { tr.classList.remove('sel'); });
  const tr = document.querySelector('#rows tr[data-slug="' + r.slug + '"]');
  if (tr) tr.classList.add('sel');
}

function renderLive() {
  $('liverows').innerHTML = D.live.map(function (p) {
    const chg = p.change_7d;
    const cls = chg === null ? '' : (chg > 0 ? 'pos' : (chg < 0 ? 'neg' : ''));
    return '<tr><td><strong>' + esc(p.name) + '</strong><span class="sub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd || 0) + '</td>' +
      '<td class="num ' + cls + '">' + pct(chg) + '</td></tr>';
  }).join('');
}

function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('q')) $('q').value = h.get('q');
  if (h.get('cat')) $('cat').value = h.get('cat');
  if (h.get('basis')) $('basis').value = h.get('basis');
  if (h.get('growers')) $('growers').checked = h.get('growers') === '1';
  if (h.get('sort')) { sortKey = h.get('sort'); sortDir = DEFAULT_DIR[sortKey] || 1; $('sort').value = h.get('sort'); }
  renderBoard();
  if (h.get('detail')) showDetail(h.get('detail'));
}

function init() {
  $('asof').textContent = D.as_of;
  $('src').textContent = D.source;
  $('boardsize').textContent = D.board_size;
  $('peerline').textContent = D.peer_multiple.toFixed(3) + ' across ' + D.peer_count + ' tokenized peers';
  const cats = Array.from(new Set(D.rows.map(function (r) { return r.category; }).filter(Boolean))).sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  const growers = D.rows.filter(function (r) { return r.change_7d !== null && r.change_7d > 0; }).length;
  const med = D.rows.map(function (r) { return r.change_7d; }).filter(function (v) { return v !== null; }).sort(function (a, b) { return a - b; });
  const med7 = med.length ? med[Math.floor(med.length / 2)] : 0;
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + D.watchlist_size + ' / ' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Peer multiple</dt><dd>' + D.peer_multiple.toFixed(3) + '</dd></div>' +
    '<div><dt>Growers (7d &gt; 0)</dt><dd>' + growers + '</dd></div>' +
    '<div><dt>Median 7d</dt><dd>' + pct(med7) + '</dd></div>';
  ['q', 'cat', 'basis', 'growers'].forEach(function (id) {
    $(id).addEventListener('input', function () { renderBoard(); });
  });
  $('sort').addEventListener('change', function () { sortKey = $('sort').value; sortDir = DEFAULT_DIR[sortKey] || 1; renderBoard(); });
  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      const k = th.getAttribute('data-k');
      if (sortKey === k) { sortDir = -sortDir; } else { sortKey = k; sortDir = DEFAULT_DIR[k] || 1; }
      $('sort').value = sortKey;
      renderBoard();
    });
  });
  $('rows').addEventListener('click', function (ev) {
    const tr = ev.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });
  renderLive();
  applyHash();
  window.addEventListener('hashchange', applyHash);
}

if (typeof document !== 'undefined') init();
