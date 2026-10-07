// English showcase drawings, simple to deep. Same helpers and step structure as cases.mjs.
import { box, note, area, arrow, tableRow, C } from './cases.mjs';
const MUTED = '#495057', GREY = '#868e96', ORANGE = '#e8590c', BLUE = '#1971c2';
const marker = (id, x, y, ch, bg) => box(id, x, y, 30, 30, ch, { bg, size: 15, shape: 'ellipse', strokeWidth: 1 });

// ---------------------------------------------------------------------------
// 1 · A flow: how a pull request gets merged
export function prFlow() {
  const y0 = 150, h = 76, w = 200, gap = 80;
  const xs = [0, 1, 2, 3].map(i => i * (w + gap));
  const mid = y0 + h / 2;
  const skeleton = [
    ...area('sheet', -40, -40, xs[3] + w + 80, 500),
    note('title', 0, 0, 'How a pull request gets merged', { size: 40 }),
    note('subtitle', 0, 58, 'Four steps, two ways back', { size: 18, color: MUTED }),
  ];
  const flow = [
    ...box('n0', xs[0], y0, w, h, 'Open a pull request', { size: 19 }),
    ...box('n1', xs[1], y0, w, h, 'Automated checks', { bg: C.yellow, size: 19 }),
    ...box('n2', xs[2], y0, w, h, 'Code review', { bg: C.blue, size: 19 }),
    ...box('n3', xs[3], y0, w, h, 'Merged', { size: 20, shape: 'ellipse', bg: C.green }),
    arrow('e0', [[xs[0] + w, mid], [xs[1], mid]]),
    arrow('e1', [[xs[1] + w, mid], [xs[2], mid]]),
    arrow('e2', [[xs[2] + w, mid], [xs[3], mid]]),
    note('e1-l', xs[1] + w + 10, mid - 30, 'pass', { size: 15, color: MUTED }),
    note('e2-l', xs[2] + w + 6, mid - 30, 'approve', { size: 15, color: MUTED }),
    ...box('f1', xs[1], y0 + 170, w, 70, 'Checks fail:\nfix and push', { bg: C.red, size: 17 }),
    ...box('f2', xs[2], y0 + 170, w, 70, 'Changes requested:\nupdate the code', { bg: C.orange, size: 17 }),
    arrow('b1', [[xs[1] + w / 2 - 30, y0 + h], [xs[1] + w / 2 - 30, y0 + 170]], { color: ORANGE }),
    arrow('b1r', [[xs[1] + w / 2 + 30, y0 + 170], [xs[1] + w / 2 + 30, y0 + h]], { color: MUTED, dashed: true }),
    arrow('b2', [[xs[2] + w / 2 - 30, y0 + h], [xs[2] + w / 2 - 30, y0 + 170]], { color: ORANGE }),
    // Changed code has to pass the checks again.
    arrow('b2r', [[xs[2], y0 + 205], [xs[1] + w + 40, y0 + 205], [xs[1] + w + 40, y0 + h + 20], [xs[1] + w, y0 + h + 20]], { color: MUTED, dashed: true }),
  ];
  return { title: 'Pull request flow', steps: [skeleton, flow] };
}

// ---------------------------------------------------------------------------
// 2 · Relations: how the three financial statements connect
export function statementsEn() {
  const step = 58, rowH = 46;
  const y = r => 250 + r * step;
  const IS = { x: 0, w: 460 }, CF = { x: 560, w: 500 }, BS = { x: 1160, cols: [340, 110, 110, 110] };
  BS.w = BS.cols.reduce((a, b) => a + b, 0);
  const width = BS.x + BS.w;
  const mid = r => y(r) + rowH / 2;
  const isRow = (r, id, label, opts = {}) => box(id, IS.x, y(r), IS.w, rowH, label, { size: 17, ...opts });
  const cfRow = (r, id, label, opts = {}) => box(id, CF.x, y(r), CF.w, rowH, label, { size: 17, ...opts });
  const bsRow = (r, id, values, opts = {}) => tableRow(id, BS.x, y(r), BS.cols, values, { h: rowH, size: 17, ...opts });
  const skeleton = [
    ...area('sheet', -40, -40, width + 80, y(11) + 440),
    note('title', 0, 0, 'How the three financial statements connect', { size: 40 }),
    note('subtitle', 0, 58, 'Example company · made-up numbers for illustration · $ thousands · every line can be checked', { size: 18, color: MUTED }),
    ...box('h-is', IS.x, 130, IS.w, 70, 'Income statement\nHow much did we earn?', { bg: C.blue, size: 20 }),
    ...box('h-cf', CF.x, 130, CF.w, 70, 'Cash flow statement\nWhere did the cash go?', { bg: C.green, size: 20 }),
    ...box('h-bs', BS.x, 130, BS.w, 70, 'Balance sheet\nWhat do we own and owe?', { bg: C.purple, size: 20 }),
  ];
  const income = [
    ...isRow(0, 'is-rev', 'Revenue  1,000'),
    ...isRow(1, 'is-cogs', 'Cost of goods sold  −600'),
    ...isRow(2, 'is-gp', 'Gross profit  400', { bg: C.grey }),
    ...isRow(3, 'is-opex', 'Expenses  −250 (incl. depreciation 40)'),
    ...isRow(4, 'is-op', 'Operating profit  150', { bg: C.grey }),
    ...isRow(5, 'is-tax', 'Income tax  −30'),
    ...isRow(6, 'is-ni', 'Net income  120', { bg: C.yellow }),
  ];
  const cash = [
    ...area('cf-op', CF.x - 10, y(0) - 34, CF.w + 20, 5 * step + 36, { label: 'Operating activities' }),
    ...cfRow(0, 'cf-ni', 'Net income  120'),
    ...cfRow(1, 'cf-da', '+ Depreciation  40 (no cash paid)'),
    ...cfRow(2, 'cf-ar', '− Increase in receivables  30'),
    ...cfRow(3, 'cf-inv', '− Increase in inventory  20'),
    ...cfRow(4, 'cf-cfo', '= Operating cash flow  110', { bg: C.grey }),
    ...area('cf-iv', CF.x - 10, y(5) - 6, CF.w + 20, step, { color: GREY }),
    ...cfRow(5, 'cf-capex', 'Investing: equipment  −80'),
    ...cfRow(6, 'cf-div', 'Financing: dividends  −20'),
    ...cfRow(7, 'cf-net', 'Net change in cash  10', { bg: C.yellow }),
  ];
  const balance = [
    ...bsRow(0, 'bs-head', ['Item', 'Start', 'End', 'Change'], { bg: C.grey, bold: true }),
    ...bsRow(1, 'bs-cash', ['Cash', '50', '60', '+10']),
    ...bsRow(2, 'bs-ar', ['Receivables', '100', '130', '+30']),
    ...bsRow(3, 'bs-inv', ['Inventory', '80', '100', '+20']),
    ...bsRow(4, 'bs-ppe', ['Equipment (+80 −40)', '270', '310', '+40']),
    ...bsRow(5, 'bs-ta', ['Total assets', '500', '600', '+100'], { bg: C.yellow, bold: true }),
    ...bsRow(7, 'bs-ap', ['Payables and other debts', '200', '200', '0']),
    ...bsRow(8, 'bs-sc', ['Share capital', '100', '100', '0']),
    ...bsRow(9, 'bs-re', ['Retained earnings (+120 −20)', '200', '300', '+100']),
    ...bsRow(10, 'bs-tl', ['Total debts and equity', '500', '600', '+100'], { bg: C.yellow, bold: true }),
    note('bs-eq', BS.x, y(11) + 4, 'Both sides go from 500 to 600, so it balances', { size: 16, color: MUTED }),
  ];
  const gap1 = (IS.x + IS.w + CF.x) / 2, gap2 = (CF.x + CF.w + BS.x) / 2;
  const links = [
    arrow('l-ni', [[IS.x + IS.w, mid(6)], [gap1, mid(6)], [gap1, mid(0)], [CF.x, mid(0)]], { color: ORANGE }),
    arrow('l-da', [[IS.x + IS.w, mid(3)], [gap1 + 14, mid(3)], [gap1 + 14, mid(1)], [CF.x, mid(1)]], { color: BLUE }),
    arrow('l-ar', [[CF.x + CF.w, mid(2)], [BS.x, mid(2)]], { color: BLUE }),
    arrow('l-inv', [[CF.x + CF.w, mid(3)], [BS.x, mid(3)]], { color: BLUE }),
    arrow('l-capex', [[CF.x + CF.w, mid(5)], [gap2 + 16, mid(5)], [gap2 + 16, mid(4)], [BS.x, mid(4)]], { color: BLUE }),
    arrow('l-cash', [[CF.x + CF.w, mid(7)], [gap2 - 18, mid(7)], [gap2 - 18, mid(1)], [BS.x, mid(1)]], { color: BLUE }),
    arrow('l-div', [[CF.x + CF.w, mid(6)], [gap2 + 34, mid(6)], [gap2 + 34, mid(9)], [BS.x, mid(9)]], { color: ORANGE }),
    arrow('l-re', [[IS.x + IS.w / 2, y(6) + rowH], [IS.x + IS.w / 2, y(8) + 30], [gap2 + 50, y(8) + 30], [gap2 + 50, mid(9) + 8], [BS.x, mid(9) + 8]], { color: ORANGE }),
    note('legend', IS.x, y(9) + 10, 'Orange: where the profit goes\nBlue: how cash and assets change', { size: 16, color: MUTED }),
  ];
  const mTop = y(11) + 110, mW = (width - 5 * 20) / 6;
  const metrics = [
    ...area('metrics', -14, mTop - 50, width + 28, 270, { label: 'Six ratios you can work out from the same numbers' }),
    ...[
      ['Gross margin', 'Gross profit ÷ revenue', '400 ÷ 1,000 = 40%', '40 kept from every 100 sold'],
      ['Cash conversion', 'Cash flow ÷ net income', '110 ÷ 120 ≈ 0.92', 'Most profit came in as cash'],
      ['Working capital', 'Receivables + inventory up', '30 + 20 = 50', 'Growth tied up 50 in cash'],
      ['Capex ÷ depreciation', 'Spend ÷ wear and tear', '80 ÷ 40 = 2×', 'Growing faster than it wears'],
      ['Free cash flow', 'Cash flow − equipment', '110 − 80 = 30', 'Left after investing'],
      ['Dividend cover', 'Free cash ÷ dividends', '30 ÷ 20 = 1.5×', 'Dividends are covered'],
    ].flatMap(([name, formula, numbers, meaning], i) => box(`k${i}`, i * (mW + 20), mTop, mW, 190, `${name}\n${formula}\n${numbers}\n${meaning}`, { bg: i === 1 || i === 4 ? C.yellow : C.white, size: 15 })),
  ];
  return { title: 'Three financial statements', steps: [skeleton, [...income, ...cash], [...balance, ...links], metrics] };
}

// ---------------------------------------------------------------------------
// 3 · An argument: Attention Is All You Need
export function transformerEn() {
  const L = { x: 0, w: 500 }, M = { x: 580, w: 1000 }, R = { x: 1660, w: 420 };
  const width = R.x + R.w;
  const skeleton = [
    ...area('sheet', -40, -40, width + 80, 1260),
    note('title', 0, 0, 'Paper breakdown · Attention Is All You Need (2017)', { size: 40 }),
    note('subtitle', 0, 58, 'Vaswani et al. · machine translation · background → model → evidence → impact · numbers from the paper', { size: 18, color: MUTED }),
  ];
  const cols = [150, 130, 105, 115];
  const background = [
    ...area('bg', L.x - 14, 110, L.w + 28, 900, { label: 'Background: why replace RNNs?' }),
    ...box('problem', L.x, 150, L.w, 150, 'The problem\nRNNs work one step at a time,\nso training is hard to parallelize\nand distant words barely interact', { bg: C.red }),
    ...box('idea', L.x, 330, L.w, 130, 'The idea\nDrop recurrence and convolution.\nUse attention only: any two words\nare one step apart', { bg: C.yellow }),
    arrow('a-pi', [[L.x + L.w / 2, 300], [L.x + L.w / 2, 330]]),
    note('t1', L.x, 486, 'Table 1 of the paper (n = sequence length, d = dimension)', { size: 15, color: MUTED }),
    ...tableRow('t1-h', L.x, 516, cols, ['Layer', 'Cost / layer', 'Seq. ops', 'Max path'], { bg: C.grey, size: 14, bold: true }),
    ...tableRow('t1-a', L.x, 560, cols, ['Self-attention', 'O(n²·d)', 'O(1)', 'O(1)'], { bg: C.green, size: 14, family: 3 }),
    ...tableRow('t1-r', L.x, 604, cols, ['Recurrent', 'O(n·d²)', 'O(n)', 'O(n)'], { size: 14, family: 3 }),
    ...tableRow('t1-c', L.x, 648, cols, ['Convolution', 'O(k·n·d²)', 'O(1)', 'O(logₖn)'], { size: 14, family: 3 }),
    ...box('t1-read', L.x, 712, L.w, 128, 'How to read it\nO(1) sequential ops: a layer runs in parallel\nO(1) path: any two words, one hop\nTrade-off: cost grows with n²', { size: 16, dashed: true }),
    ...box('hp', L.x, 870, L.w, 120, 'Base model settings\nN = 6 layers · d_model = 512 · d_ff = 2048\nh = 8 heads · d_k = d_v = 64', { bg: C.grey, size: 16 }),
  ];
  const ex = M.x + 20, dx = M.x + 380, bw = 320, sh = 46, sg = 12;
  const stack = (id, x, top, items, color) => items.flatMap((t, i) => box(`${id}${i}`, x, top + i * (sh + sg), bw, sh, t, { bg: color(i), size: 16 }));
  const encItems = ['Multi-head self-attention', 'Residual + layer norm', 'Feed-forward network', 'Residual + layer norm'];
  const decItems = ['Masked self-attention', 'Residual + layer norm', 'Encoder–decoder attention', 'Residual + layer norm', 'Feed-forward network', 'Residual + layer norm'];
  const encTop = 330, decTop = 330;
  const model = [
    ...area('model', M.x - 14, 110, M.w + 28, 900, { label: 'Model: the encoder reads, the decoder writes' }),
    ...box('enc-in', ex, 150, bw, 46, 'Source sentence', { bg: C.grey, size: 16 }),
    ...box('enc-emb', ex, 226, bw, 56, 'Embeddings + positions', { size: 16 }),
    arrow('a-e0', [[ex + bw / 2, 196], [ex + bw / 2, 226]]),
    ...area('enc-stack', ex - 12, encTop - 20, bw + 24, 4 * (sh + sg) + 28, { color: BLUE }),
    note('enc-n', ex + bw - 48, encTop - 48, '× 6', { size: 22, color: BLUE }),
    arrow('a-e1', [[ex + bw / 2, 282], [ex + bw / 2, encTop - 20]]),
    ...stack('enc', ex, encTop, encItems, i => i % 2 ? C.white : C.blue),
    ...box('enc-out', ex, encTop + 4 * (sh + sg) + 40, bw, 56, 'One vector per source word', { bg: C.blue, size: 15 }),
    arrow('a-e2', [[ex + bw / 2, encTop + 4 * (sh + sg) + 8], [ex + bw / 2, encTop + 4 * (sh + sg) + 40]]),
    note('kv', ex, encTop + 4 * (sh + sg) + 108, 'The encoder output becomes K and V\nfor every decoder layer', { size: 16, color: BLUE }),
    ...box('dec-in', dx, 150, bw, 46, 'Words written so far', { bg: C.grey, size: 16 }),
    ...box('dec-emb', dx, 226, bw, 56, 'Embeddings + positions', { size: 16 }),
    arrow('a-d0', [[dx + bw / 2, 196], [dx + bw / 2, 226]]),
    ...area('dec-stack', dx - 12, decTop - 20, bw + 24, 6 * (sh + sg) + 28, { color: '#2f9e44' }),
    note('dec-n', dx + bw - 48, decTop - 48, '× 6', { size: 22, color: '#2f9e44' }),
    arrow('a-d1', [[dx + bw / 2, 282], [dx + bw / 2, decTop - 20]]),
    ...stack('dec', dx, decTop, decItems, i => i % 2 ? C.white : C.green),
    ...box('dec-lin', dx, decTop + 6 * (sh + sg) + 40, bw, 46, 'Linear + softmax', { size: 16 }),
    ...box('dec-out', dx, decTop + 6 * (sh + sg) + 116, bw, 56, 'Next-word probabilities', { bg: C.green, size: 16 }),
    arrow('a-d2', [[dx + bw / 2, decTop + 6 * (sh + sg) + 8], [dx + bw / 2, decTop + 6 * (sh + sg) + 40]]),
    arrow('a-d3', [[dx + bw / 2, decTop + 6 * (sh + sg) + 86], [dx + bw / 2, decTop + 6 * (sh + sg) + 116]]),
    arrow('a-kv', [[ex + bw, encTop + 4 * (sh + sg) + 68], [ex + bw + 20, encTop + 4 * (sh + sg) + 68], [ex + bw + 20, decTop + 2 * (sh + sg) + sh / 2], [dx, decTop + 2 * (sh + sg) + sh / 2]], { color: BLUE }),
  ];
  const zx = M.x + 724, zw = 262;
  const zoom = [
    ...area('zoom', zx - 12, 150, zw + 24, 640, { color: ORANGE, label: 'Zoom: multi-head attention' }),
    arrow('a-zoom', [[ex + bw, encTop + sh / 2], [ex + bw + 12, encTop + sh / 2], [ex + bw + 12, 132], [zx + zw / 2, 132], [zx + zw / 2, 150]], { color: ORANGE, dashed: true }),
    ...box('z-qkv', zx, 196, zw, 46, 'Q    K    V', { size: 18, family: 3 }),
    ...box('z-proj', zx, 272, zw, 70, 'Project each one,\nsplit into h = 8 heads', { bg: C.orange, size: 16 }),
    ...box('z-attn', zx, 372, zw, 150, 'In each head:\nscaled dot-product\nattention\nsoftmax(QKᵀ / √dₖ) · V', { bg: C.yellow, size: 16 }),
    ...box('z-cat', zx, 552, zw, 56, 'Join the 8 results', { size: 16 }),
    ...box('z-lin', zx, 638, zw, 56, 'One more linear layer', { size: 16 }),
    note('z-why', zx, 712, 'Each head can follow a\ndifferent relationship', { size: 15, color: MUTED }),
    arrow('z-a0', [[zx + zw / 2, 242], [zx + zw / 2, 272]]),
    arrow('z-a1', [[zx + zw / 2, 342], [zx + zw / 2, 372]]),
    arrow('z-a2', [[zx + zw / 2, 522], [zx + zw / 2, 552]]),
    arrow('z-a3', [[zx + zw / 2, 608], [zx + zw / 2, 638]]),
  ];
  const third = (width - 40) / 3;
  const evidence = [
    ...area('ev', R.x - 14, 110, R.w + 28, 900, { label: 'Evidence: quality, cost, ablations' }),
    ...box('res', R.x, 150, R.w, 150, 'Translation quality\nWMT14 English→German: 28.4 BLEU,\nover 2 BLEU above the previous best,\nensembles included', { bg: C.purple }),
    ...box('cost', R.x, 330, R.w, 130, 'Training cost\n8 NVIDIA P100 GPUs\nbase ~12 hours, big model 3.5 days', { bg: C.white }),
    ...box('abl', R.x, 490, R.w, 150, 'Ablation\nOne head is 0.9 BLEU worse\nthan the best setting,\nand too many heads also hurts', { bg: C.white }),
    ...box('gen', R.x, 670, R.w, 130, 'Does it generalize?\nIt also does well on\nEnglish constituency parsing', { bg: C.white }),
    arrow('a-me', [[M.x + M.w + 14, 225], [R.x - 14, 225]]),
    ...area('end', L.x - 14, 1050, width + 28, 150, { label: 'Impact and limits' }),
    ...box('impact', 0, 1090, third, 80, 'Impact: the basis of BERT, GPT\nand many later models', { bg: C.green, size: 17 }),
    ...box('limit', third + 20, 1090, third, 80, 'Limit: attention cost grows with\nthe square of sequence length', { bg: C.grey, size: 17 }),
    ...box('oneline', 2 * (third + 20), 1090, third, 80, 'In one line: parallel attention\nreplaces recurrence', { bg: C.yellow, size: 17 }),
  ];
  return { title: 'Attention paper breakdown', steps: [skeleton, background, [...model, ...zoom], evidence] };
}

// ---------------------------------------------------------------------------
// 4 · A whole book: The Art of War (chapter titles and quotes: Lionel Giles, 1910)
export function artOfWar() {
  const colW = 360, gap = 50, top = 280, chapterH = 136, chapterGap = 16;
  const ideas = {
    K: [C.blue, 'Know', 'Understand both sides, the weather and the ground before deciding', 'I · III · IX · X · XIII', '“If you know the enemy and know yourself, you need not fear the result of a hundred battles.”'],
    W: [C.green, 'Win whole', 'Win at the lowest cost, ideally without fighting', 'III · IV · XII', '“Supreme excellence consists in breaking the enemy’s resistance without fighting.”'],
    M: [C.yellow, 'Momentum', 'Set things up so the situation does the work', 'V · VI · XI', 'Shape the situation before you commit.'],
    A: [C.orange, 'Adapt', 'No fixed playbook; change with the enemy', 'VI · VII · VIII', '“Just as water retains no constant shape, so in warfare there are no constant conditions.”'],
    S: [C.red, 'Speed', 'Long campaigns drain everyone; move fast', 'II · VII · XI', '“Let your great object be victory, not lengthy campaigns.”'],
  };
  const groups = [
    ['1 · Decide', 'Should we fight at all?', C.purple, [
      ['I · Laying Plans', 'Weigh five factors first:\nmoral law, heaven, earth,\ncommander, discipline', 'K'],
      ['II · Waging War', 'Wars are costly;\nwin quickly and live\noff the enemy', 'S'],
      ['III · Attack by Stratagem', 'Best is to win whole;\nattack the enemy’s plans\nbefore his army', 'WK']]],
    ['2 · Build strength', 'Be unbeatable first', C.blue, [
      ['IV · Tactical Dispositions', 'Make yourself impossible\nto defeat, then wait for\nthe enemy’s mistake', 'W'],
      ['V · Energy', 'Combine direct and\nindirect methods;\nlet momentum carry you', 'M'],
      ['VI · Weak Points and Strong', 'Avoid strength, strike\nweakness; make the enemy\ncome to you', 'MA']]],
    ['3 · Command', 'Move and adapt in the field', C.green, [
      ['VII · Maneuvering', 'The long way round can\nbe the shortest; seize\nthe advantage first', 'AS'],
      ['VIII · Variation in Tactics', 'Adapt to circumstances;\na general has five\ndangerous faults', 'A'],
      ['IX · The Army on the March', 'Where to camp, and how\nto read signs of the\nenemy’s condition', 'K']]],
    ['4 · Use the ground', 'Let terrain decide', C.orange, [
      ['X · Terrain', 'Six kinds of ground;\nknow heaven and earth\nto win completely', 'K'],
      ['XI · The Nine Situations', 'Nine kinds of ground;\ntroops in desperate\nplaces fight hardest', 'MS']]],
    ['5 · Fire and spies', 'Special means', C.red, [
      ['XII · The Attack by Fire', 'Five ways to use fire;\nnever start a war\nout of anger', 'W'],
      ['XIII · The Use of Spies', 'Five kinds of spies;\nforeknowledge comes from\npeople, not spirits', 'K']]],
  ];
  const width = groups.length * colW + (groups.length - 1) * gap;
  const conceptTop = top + 84 + 3 * (chapterH + chapterGap) + 76;
  const usesTop = conceptTop + 280;
  const height = usesTop + 120;
  const skeleton = [
    ...area('sheet', -40, -40, width + 80, height + 80),
    note('title', 0, 0, 'The Art of War · thirteen chapters on one page', { size: 40 }),
    note('subtitle', 0, 58, 'One thread → five groups of chapters → five recurring ideas → how it reads today · grouping is one common reading; quotes from the Lionel Giles translation (1910)', { size: 17, color: MUTED }),
  ];
  const core = [
    ...box('core', width / 2 - 330, 116, 660, 92, 'The thread through the book: win first, then fight\n“the victorious strategist only seeks battle after the victory has been won”', { bg: C.yellow, size: 17 }),
    ...box('legend', width - 440, 116, 440, 92, 'Dots show which recurring ideas a chapter uses:\nK know · W win whole · M momentum · A adapt · S speed', { size: 15, dashed: true }),
    ...box('method', 0, 116, 420, 92, 'How to read: the thread first, then the\nfive groups, then follow the dots', { size: 15, dashed: true }),
  ];
  const column = (i) => {
    const [name, gloss, color, chapters] = groups[i];
    const x = i * (colW + gap);
    return [
      ...area(`g${i}`, x - 14, top - 14, colW + 28, 84 + 3 * (chapterH + chapterGap) + 14),
      arrow(`ga${i}`, [[width / 2, 208], [x + colW / 2, top]], { color: MUTED }),
      ...box(`gh${i}`, x, top, colW, 66, `${name}\n${gloss}`, { bg: color, size: 19 }),
      ...chapters.flatMap(([title, gist, tags], j) => {
        const y = top + 84 + j * (chapterH + chapterGap);
        return [
          ...box(`c${i}-${j}`, x, y, colW, chapterH, `${title}\n${gist}`, { size: 16 }),
          ...[...tags].flatMap((t, k) => marker(`m${i}-${j}-${k}`, x + colW - 40 - k * 36, y + chapterH - 40, t, ideas[t][0])),
        ];
      }),
    ];
  };
  const conceptW = (width - 4 * 24) / 5;
  const conceptBand = [
    ...area('concepts', -14, conceptTop - 46, width + 28, 280, { label: 'Five ideas that recur through the book (the dots)' }),
    ...Object.entries(ideas).flatMap(([letter, [color, name, meaning, chapters, quote]], i) => {
      const x = i * (conceptW + 24);
      const wrap = s => s.replace(/(.{1,34})(\s|$)/g, '$1\n').trim();
      return [
        ...marker(`k${i}-dot`, x + 14, conceptTop + 14, letter, color),
        ...box(`k${i}`, x, conceptTop, conceptW, 206, `${name}\n${wrap(meaning)}\nChapters ${chapters}\n${wrap(quote)}`, { bg: color, size: 15 }),
      ];
    }),
  ];
  const uses = [
    ...area('uses', -14, usesTop - 40, width + 28, 160, { label: 'How it reads today (an analogy, not the text)' }),
    ...[
      ['Laying plans →\nsize up resources and odds first', C.purple],
      ['Know the enemy →\nresearch users and competitors', C.blue],
      ['Momentum →\npick the right timing and channel', C.yellow],
      ['Win whole →\navoid price wars when you can', C.green],
      ['Spies →\nfirst-hand information beats guessing', C.red],
    ].flatMap(([t, color], i) => box(`u${i}`, i * (conceptW + 24), usesTop, conceptW, 80, t, { bg: color, size: 16 })),
  ];
  return { title: 'The Art of War', steps: [skeleton, [...core, ...column(0), ...column(1)], [...column(2), ...column(3), ...column(4)], [...conceptBand, ...uses]] };
}

/** Simple to deep: a flow, connected numbers, an argument, a whole book. */
export const allCasesEn = () => [prFlow(), statementsEn(), transformerEn(), artOfWar()];
