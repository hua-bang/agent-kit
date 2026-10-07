// Three complex showcase drawings, written as an agent would: complete Excalidraw elements with
// stable IDs, delivered in steps through patch_drawing. Each case: { title, steps: Element[][] }.
const CJK = /[⺀-鿿　-〿＀-￯]/;
const widthOf = (s, size) => [...s].reduce((w, c) => w + (CJK.test(c) ? size * 1.08 : c === ' ' ? size * .4 : size * .72), 0);
let seq = 1;
const base = () => ({ seed: seq++, roughness: 1, strokeWidth: 2, strokeColor: '#1e1e1e', opacity: 100, angle: 0 });
const INK = '#1e1e1e', MUTED = '#495057', GREY = '#868e96';
export const C = { yellow: '#ffec99', blue: '#a5d8ff', green: '#b2f2bb', red: '#ffc9c9', purple: '#d0bfff', orange: '#ffd8a8', grey: '#e9ecef', white: '#ffffff' };

function text(id, x, y, value, { size = 18, color = INK, align = 'left', family = 1, container } = {}) {
  const lines = value.split('\n');
  const width = Math.ceil(Math.max(...lines.map(l => widthOf(l, size))));
  const height = Math.ceil(lines.length * size * 1.25);
  return { ...base(), id, type: 'text', x: align === 'center' ? x - width / 2 : align === 'right' ? x - width : x, y, width, height, text: value, originalText: value,
    fontSize: size, fontFamily: family, textAlign: align, verticalAlign: container ? 'middle' : 'top', lineHeight: 1.25, strokeColor: color,
    backgroundColor: 'transparent', containerId: container ?? null };
}
/** A shape with bound text spanning its inner width, so Excalidraw centres it and never clips it. */
export function box(id, x, y, w, h, value, { bg = C.white, size = 17, shape = 'rectangle', dashed = false, stroke = INK, family = 1, strokeWidth = 2 } = {}) {
  const pad = w < 60 ? 1 : 10;
  const t = text(`${id}-t`, x + pad, 0, value, { size, align: 'center', container: id, family });
  t.x = x + pad; t.width = w - 2 * pad; t.y = y + (h - t.height) / 2;
  return [
    { ...base(), id, type: shape, x, y, width: w, height: h, backgroundColor: bg, fillStyle: 'solid', strokeColor: stroke, strokeWidth,
      strokeStyle: dashed ? 'dashed' : 'solid', roundness: shape === 'rectangle' ? { type: 3 } : null, boundElements: [{ type: 'text', id: t.id }] },
    t,
  ];
}
export const note = (id, x, y, value, opts) => text(id, x, y, value, opts);
export function area(id, x, y, w, h, { bg = 'transparent', label, color = GREY } = {}) {
  return [
    { ...base(), id, type: 'rectangle', x, y, width: w, height: h, backgroundColor: bg, fillStyle: 'solid', strokeStyle: 'dashed', strokeColor: color, strokeWidth: 1, roundness: { type: 3 } },
    ...(label ? [text(`${id}-l`, x + 14, y + 10, label, { size: 16, color: MUTED })] : []),
  ];
}
export function arrow(id, points, { color = INK, dashed = false, width = 2, head = 'arrow' } = {}) {
  const [x0, y0] = points[0];
  const rel = points.map(([x, y]) => [x - x0, y - y0]);
  const xs = rel.map(p => p[0]), ys = rel.map(p => p[1]);
  return { ...base(), id, type: 'arrow', x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    points: rel, strokeColor: color, strokeWidth: width, strokeStyle: dashed ? 'dashed' : 'solid', backgroundColor: 'transparent',
    endArrowhead: head, startArrowhead: null, roundness: points.length > 2 ? null : { type: 2 } };
}
/** One table row: a single outlined strip with a text per cell. `cols` are cell widths; the first cell is left-aligned. */
export function tableRow(id, x, y, cols, values, { h = 44, bg = C.white, size = 16, bold = false, family = 1, stroke = INK } = {}) {
  const els = [{ ...base(), id, type: 'rectangle', x, y, width: cols.reduce((a, b) => a + b, 0), height: h, backgroundColor: bg, fillStyle: 'solid',
    strokeColor: stroke, strokeWidth: bold ? 2 : 1, roundness: null }];
  let cx = x;
  values.forEach((v, i) => {
    const t = text(`${id}-c${i}`, i === 0 ? cx + 12 : cx + cols[i] / 2, y + (h - size * 1.25) / 2, v, { size, align: i === 0 ? 'left' : 'center', family: i === 0 ? 1 : family });
    els.push(t); cx += cols[i];
  });
  return els;
}
const marker = (id, x, y, ch, bg) => box(id, x, y, 30, 30, ch, { bg, size: 15, shape: 'ellipse', strokeWidth: 1 });

// ---------------------------------------------------------------------------
// 拆书：《孙子兵法》—— 主线 → 五组十三篇 → 五个核心概念 → 今天怎么读
export function sunzi() {
  const colW = 330, gap = 50, top = 280, chapterH = 136, chapterGap = 16;
  const concepts = {
    知: [C.blue, '知', '先弄清敌我、天时地利，再决定打不打', '始计 · 谋攻 · 行军 · 地形 · 用间', '「知彼知己，百战不殆」'],
    全: [C.green, '全', '以最小代价取胜，最好不战而胜', '谋攻 · 军形 · 火攻', '「不战而屈人之兵，善之善者也」'],
    势: [C.yellow, '势', '造势、借势，让局面替自己作战', '兵势 · 虚实 · 九地', '「如转圆石于千仞之山者，势也」'],
    变: [C.orange, '变', '没有固定打法，随敌情变化', '虚实 · 军争 · 九变', '「兵无常势，水无常形」'],
    速: [C.red, '速', '久拖必伤，行动要快', '作战 · 军争 · 九地', '「兵之情主速」'],
  };
  const groups = [
    ['一 · 战略决策', '打不打、怎么算', C.purple, [
      ['始计第一', '五事：道、天、地、将、法', '「多算胜，少算不胜」', '知'],
      ['作战第二', '速战速决，因粮于敌', '「兵贵胜，不贵久」', '速'],
      ['谋攻第三', '全胜为上，伐谋为先', '「知彼知己，百战不殆」', '全知']]],
    ['二 · 实力与态势', '先立于不败', C.blue, [
      ['军形第四', '先立于不败之地', '「先为不可胜，以待敌之可胜」', '全'],
      ['兵势第五', '奇正相生，借势而为', '「以正合，以奇胜」', '势'],
      ['虚实第六', '避实击虚，掌握主动', '「致人而不致于人」', '势变']]],
    ['三 · 临阵指挥', '机动与应变', C.green, [
      ['军争第七', '争夺先机，化迂为直', '「以迂为直，以患为利」', '变速'],
      ['九变第八', '临机变通，将有五危', '「将通于九变之利者，知用兵矣」', '变'],
      ['行军第九', '处军之法，观察敌情', '「兵非益多也，惟无武进」', '知']]],
    ['四 · 环境与地形', '因地制胜', C.orange, [
      ['地形第十', '通、挂、支、隘、险、远', '「知天知地，胜乃可全」', '知'],
      ['九地第十一', '九种战地，因势用兵', '「投之亡地然后存，陷之死地然后生」', '势速']]],
    ['五 · 特殊手段', '火攻与用间', C.red, [
      ['火攻第十二', '五火：人、积、辎、库、队', '「主不可以怒而兴师」', '全'],
      ['用间第十三', '五间：因、内、反、死、生', '「先知者，不可取于鬼神」', '知']]],
  ];
  const width = groups.length * colW + (groups.length - 1) * gap;
  const conceptTop = top + 84 + 3 * (chapterH + chapterGap) + 76;
  const usesTop = conceptTop + 260;
  const height = usesTop + 110;
  const skeleton = [
    // The sheet outline sizes the drawing up front, so an editor that fits on open frames the whole result.
    ...area('sheet', -40, -40, width + 80, height + 80),
    note('title', 0, 0, '《孙子兵法》十三篇 · 结构拆解', { size: 40 }),
    note('subtitle', 0, 58, '主线 → 五组十三篇 → 五个贯穿全书的概念 → 放到今天怎么读 · 分组是一种常见读法，引句出自原文', { size: 18, color: MUTED }),
  ];
  const core = [
    ...box('core', width / 2 - 300, 116, 600, 92, '全书主线：胜兵先胜而后求战\n先创造必胜的条件，再去交战（军形篇）', { bg: C.yellow, size: 21 }),
    ...box('legend', width - 470, 116, 470, 92, '圆点 = 这一篇涉及的核心概念\n知 · 全 · 势 · 变 · 速，见下方说明', { bg: C.white, size: 16, dashed: true }),
    ...box('method', 0, 116, 420, 92, '读法：先看主线，再按五组读各篇，\n最后用圆点把同一概念串起来', { bg: C.white, size: 16, dashed: true }),
  ];
  const column = (i) => {
    const [name, gloss, color, chapters] = groups[i];
    const x = i * (colW + gap);
    return [
      ...area(`g${i}`, x - 14, top - 14, colW + 28, 84 + 3 * (chapterH + chapterGap) + 14),
      arrow(`ga${i}`, [[width / 2, 208], [x + colW / 2, top]], { color: MUTED }),
      ...box(`gh${i}`, x, top, colW, 66, `${name}\n${gloss}`, { bg: color, size: 19 }),
      ...chapters.flatMap(([title, gist, quote, tags], j) => {
        const y = top + 84 + j * (chapterH + chapterGap);
        return [
          ...box(`c${i}-${j}`, x, y, colW, chapterH, `${title}\n${gist}\n${quote}`, { size: 16 }),
          ...[...tags].flatMap((t, k) => marker(`m${i}-${j}-${k}`, x + colW - 40 - k * 36, y + 10, t, concepts[t][0])),
        ];
      }),
    ];
  };
  const conceptW = (width - 4 * 24) / 5;
  const conceptBand = [
    ...area('concepts', -14, conceptTop - 46, width + 28, 260, { label: '五个贯穿全书的概念（圆点索引）' }),
    ...Object.values(concepts).flatMap(([color, ch, meaning, chapters, quote], i) => {
      const x = i * (conceptW + 24);
      return [
        ...marker(`k${i}-dot`, x + 14, conceptTop + 14, ch, color),
        ...box(`k${i}`, x, conceptTop, conceptW, 186, `${ch}：${meaning}\n出现在：${chapters}\n${quote}`, { bg: color, size: 16 }),
      ];
    }),
  ];
  const uses = [
    ...area('uses', -14, usesTop - 40, width + 28, 150, { label: '放到今天怎么读（类比，不是原文）' }),
    ...[
      ['庙算 → 立项前算清资源和胜率', C.purple],
      ['知彼知己 → 先做用户和竞品研究', C.blue],
      ['借势 → 选对时机、平台和渠道', C.yellow],
      ['全胜 → 能合作就别打价格战', C.green],
      ['用间 → 一手信息比猜测可靠', C.red],
    ].flatMap(([t, color], i) => box(`u${i}`, i * (conceptW + 24), usesTop, conceptW, 64, t, { bg: C.white, stroke: INK, size: 17 })
      .map((e, n) => n === 0 ? { ...e, backgroundColor: color } : e)),
  ];
  return { title: '《孙子兵法》拆书', steps: [skeleton, [...core, ...column(0), ...column(1)], [...column(2), ...column(3), ...column(4)], [...conceptBand, ...uses]] };
}

// ---------------------------------------------------------------------------
// 财报：三张表的勾稽关系，再到判断（虚构示例公司）
export function statements() {
  const step = 58, rowH = 46;
  const y = r => 250 + r * step;
  const IS = { x: 0, w: 420 }, CF = { x: 520, w: 460 }, BS = { x: 1080, cols: [250, 130, 130, 130] };
  BS.w = BS.cols.reduce((a, b) => a + b, 0);
  const width = BS.x + BS.w;
  const mid = r => y(r) + rowH / 2;
  const isRow = (r, id, label, opts = {}) => box(id, IS.x, y(r), IS.w, rowH, label, { size: 17, ...opts });
  const cfRow = (r, id, label, opts = {}) => box(id, CF.x, y(r), CF.w, rowH, label, { size: 17, ...opts });
  const bsRow = (r, id, values, opts = {}) => tableRow(id, BS.x, y(r), BS.cols, values, { h: rowH, size: 17, ...opts });
  const sheetH = y(11) + 400;
  const skeleton = [
    ...area('sheet', -40, -40, width + 80, sheetH + 40),
    note('title', 0, 0, '三张报表怎么对上，又能看出什么', { size: 40 }),
    note('subtitle', 0, 58, '示例公司 · 虚构数字，只为演示 · 单位：万元 · 每条连线都能用数字核对', { size: 18, color: MUTED }),
    ...box('h-is', IS.x, 130, IS.w, 70, '利润表\n这一年赚了多少', { bg: C.blue, size: 20 }),
    ...box('h-cf', CF.x, 130, CF.w, 70, '现金流量表\n钱从哪来、到哪去', { bg: C.green, size: 20 }),
    ...box('h-bs', BS.x, 130, BS.w, 70, '资产负债表\n期初和期末各有什么', { bg: C.purple, size: 20 }),
  ];
  const income = [
    ...isRow(0, 'is-rev', '营业收入  1,000'),
    ...isRow(1, 'is-cogs', '营业成本  −600'),
    ...isRow(2, 'is-gp', '毛利  400', { bg: C.grey }),
    ...isRow(3, 'is-opex', '期间费用  −250（含折旧 40）'),
    ...isRow(4, 'is-op', '营业利润  150', { bg: C.grey }),
    ...isRow(5, 'is-tax', '所得税  −30'),
    ...isRow(6, 'is-ni', '净利润  120', { bg: C.yellow }),
  ];
  const cash = [
    ...area('cf-op', CF.x - 10, y(0) - 34, CF.w + 20, 5 * step + 36, { label: '经营活动' }),
    ...cfRow(0, 'cf-ni', '净利润  120'),
    ...cfRow(1, 'cf-da', '+ 折旧  40（费用里扣了，但没付现金）'),
    ...cfRow(2, 'cf-ar', '− 应收账款增加  30'),
    ...cfRow(3, 'cf-inv', '− 存货增加  20'),
    ...cfRow(4, 'cf-cfo', '= 经营现金流  110', { bg: C.grey }),
    ...area('cf-iv', CF.x - 10, y(5) - 6, CF.w + 20, step, { color: GREY }),
    ...cfRow(5, 'cf-capex', '投资活动：买设备  −80'),
    ...cfRow(6, 'cf-div', '筹资活动：分红  −20'),
    ...cfRow(7, 'cf-net', '现金净增加  10', { bg: C.yellow }),
  ];
  const balance = [
    ...bsRow(0, 'bs-head', ['项目', '期初', '期末', '变化'], { bg: C.grey, bold: true }),
    ...bsRow(1, 'bs-cash', ['现金', '50', '60', '+10']),
    ...bsRow(2, 'bs-ar', ['应收账款', '100', '130', '+30']),
    ...bsRow(3, 'bs-inv', ['存货', '80', '100', '+20']),
    ...bsRow(4, 'bs-ppe', ['固定资产（+80 −40）', '270', '310', '+40']),
    ...bsRow(5, 'bs-ta', ['资产合计', '500', '600', '+100'], { bg: C.yellow, bold: true }),
    ...bsRow(7, 'bs-ap', ['应付账款等负债', '200', '200', '0']),
    ...bsRow(8, 'bs-sc', ['股本', '100', '100', '0']),
    ...bsRow(9, 'bs-re', ['未分配利润（+120 −20）', '200', '300', '+100']),
    ...bsRow(10, 'bs-tl', ['负债和权益合计', '500', '600', '+100'], { bg: C.yellow, bold: true }),
    note('bs-eq', BS.x, y(11) + 4, '两边都从 500 变成 600，表就平了', { size: 16, color: MUTED }),
  ];
  const orange = { color: '#e8590c' }, blue = { color: '#1971c2' };
  const gap1 = (IS.x + IS.w + CF.x) / 2, gap2 = (CF.x + CF.w + BS.x) / 2;
  const links = [
    arrow('l-ni', [[IS.x + IS.w, mid(6)], [gap1, mid(6)], [gap1, mid(0)], [CF.x, mid(0)]], orange),
    arrow('l-da', [[IS.x + IS.w, mid(3)], [gap1 + 14, mid(3)], [gap1 + 14, mid(1)], [CF.x, mid(1)]], blue),
    arrow('l-ar', [[CF.x + CF.w, mid(2)], [BS.x, mid(2)]], blue),
    arrow('l-inv', [[CF.x + CF.w, mid(3)], [BS.x, mid(3)]], blue),
    arrow('l-capex', [[CF.x + CF.w, mid(5)], [gap2 + 16, mid(5)], [gap2 + 16, mid(4)], [BS.x, mid(4)]], blue),
    arrow('l-cash', [[CF.x + CF.w, mid(7)], [gap2 - 18, mid(7)], [gap2 - 18, mid(1)], [BS.x, mid(1)]], blue),
    arrow('l-div', [[CF.x + CF.w, mid(6)], [gap2 + 34, mid(6)], [gap2 + 34, mid(9)], [BS.x, mid(9)]], orange),
    arrow('l-re', [[IS.x + IS.w / 2, y(6) + rowH], [IS.x + IS.w / 2, y(8) + 30], [gap2 + 50, y(8) + 30], [gap2 + 50, mid(9) + 8], [BS.x, mid(9) + 8]], orange),
    note('legend', IS.x, y(9) + 10, '橙线：利润去了哪里\n蓝线：现金和资产怎么变', { size: 16, color: MUTED }),
  ];
  const mTop = y(11) + 110, mW = (width - 5 * 20) / 6;
  const metrics = [
    ...area('metrics', -14, mTop - 50, width + 28, 270, { label: '用这些数字直接算出六个常用指标' }),
    ...[
      ['毛利率', '毛利 ÷ 收入', '400 ÷ 1,000 = 40%', '每卖 100 元剩 40 元毛利'],
      ['利润含金量', '经营现金流 ÷ 净利润', '110 ÷ 120 ≈ 0.92', '利润大部分收成了现金'],
      ['营运资本占用', '应收增加 + 存货增加', '30 + 20 = 50', '增长先垫进去 50 现金'],
      ['资本开支 ÷ 折旧', '买设备 ÷ 设备损耗', '80 ÷ 40 = 2 倍', '投资快于损耗，在扩张'],
      ['自由现金流', '经营现金流 − 资本开支', '110 − 80 = 30', '扣掉投资后还剩 30'],
      ['分红覆盖', '自由现金流 ÷ 分红', '30 ÷ 20 = 1.5 倍', '分红没超过可支配现金'],
    ].flatMap(([name, formula, numbers, meaning], i) => box(`k${i}`, i * (mW + 20), mTop, mW, 190, `${name}\n${formula}\n${numbers}\n${meaning}`, { bg: i === 1 || i === 4 ? C.yellow : C.white, size: 16 })),
  ];
  return { title: '财报三张表', steps: [skeleton, [...income, ...cash], [...balance, ...links], metrics] };
}

// ---------------------------------------------------------------------------
// 研究：论文拆解《Attention Is All You Need》—— 背景 → 模型 → 证据 → 影响
export function transformer() {
  const L = { x: 0, w: 460 }, M = { x: 540, w: 980 }, R = { x: 1600, w: 420 };
  const width = R.x + R.w;
  const skeleton = [
    ...area('sheet', -40, -40, width + 80, 1260),
    note('title', 0, 0, '论文拆解 · Attention Is All You Need（2017）', { size: 40 }),
    note('subtitle', 0, 58, 'Vaswani 等 · 机器翻译 · 背景 → 模型 → 证据 → 影响 · 数字均出自论文', { size: 18, color: MUTED }),
  ];
  // Background: the problem and Table 1 of the paper.
  const cols = [130, 120, 100, 110];
  const background = [
    ...area('bg', L.x - 14, 110, L.w + 28, 900, { label: '背景：为什么要换掉 RNN' }),
    ...box('problem', L.x, 150, L.w, 150, '要解决的问题\nRNN 必须一步一步算，训练难以并行\n句子越长，远处的词越难互相影响', { bg: C.red }),
    ...box('idea', L.x, 330, L.w, 120, '核心想法\n去掉循环和卷积，只用注意力\n任意两个词之间一步直连', { bg: C.yellow }),
    arrow('a-pi', [[L.x + L.w / 2, 300], [L.x + L.w / 2, 330]]),
    note('t1', L.x, 486, '论文表 1：三种层的对比（n 为序列长度，d 为维度）', { size: 15, color: MUTED }),
    ...tableRow('t1-h', L.x, 516, cols, ['层类型', '每层计算量', '顺序步数', '最长路径'], { bg: C.grey, size: 15, bold: true }),
    ...tableRow('t1-a', L.x, 560, cols, ['自注意力', 'O(n²·d)', 'O(1)', 'O(1)'], { bg: C.green, size: 15, family: 3 }),
    ...tableRow('t1-r', L.x, 604, cols, ['循环', 'O(n·d²)', 'O(n)', 'O(n)'], { size: 15, family: 3 }),
    ...tableRow('t1-c', L.x, 648, cols, ['卷积', 'O(k·n·d²)', 'O(1)', 'O(logₖn)'], { size: 15, family: 3 }),
    ...box('t1-read', L.x, 712, L.w, 128, '怎么读这张表\n顺序步数 O(1)：整层可以并行\n最长路径 O(1)：远距离依赖也只隔一步\n代价：计算量随 n² 增长', { size: 16, dashed: true }),
    ...box('hp', L.x, 870, L.w, 120, '基础模型的关键参数\nN = 6 层 · d_model = 512 · d_ff = 2048\nh = 8 头 · d_k = d_v = 64', { bg: C.grey, size: 16 }),
  ];
  // Model: encoder and decoder data flow, plus a zoom-in on multi-head attention.
  const ex = M.x + 20, dx = M.x + 360, bw = 300, sh = 46, sg = 12;
  const stack = (id, x, top, items, color) => items.flatMap((t, i) => box(`${id}${i}`, x, top + i * (sh + sg), bw, sh, t, { bg: color(i), size: 16 }));
  const encItems = ['多头自注意力', '残差连接 + 层归一化', '前馈网络', '残差连接 + 层归一化'];
  const decItems = ['掩码多头自注意力（看不到后面的词）', '残差连接 + 层归一化', '编码器-解码器注意力', '残差连接 + 层归一化', '前馈网络', '残差连接 + 层归一化'];
  const norm = i => i % 2 ? C.white : C.blue;
  const dnorm = i => i % 2 ? C.white : C.green;
  const encTop = 330, decTop = 330;
  const model = [
    ...area('model', M.x - 14, 110, M.w + 28, 900, { label: '模型：编码器读原句，解码器逐词生成译文' }),
    ...box('enc-in', ex, 150, bw, 46, '原句的词', { bg: C.grey, size: 16 }),
    ...box('enc-emb', ex, 226, bw, 56, '词嵌入 + 正弦位置编码', { size: 16 }),
    arrow('a-e0', [[ex + bw / 2, 196], [ex + bw / 2, 226]]),
    ...area('enc-stack', ex - 12, encTop - 20, bw + 24, 4 * (sh + sg) + 28, { color: '#1971c2' }),
    note('enc-n', ex + bw - 48, encTop - 48, '× 6', { size: 22, color: '#1971c2' }),
    arrow('a-e1', [[ex + bw / 2, 282], [ex + bw / 2, encTop - 20]]),
    ...stack('enc', ex, encTop, encItems, norm),
    ...box('enc-out', ex, encTop + 4 * (sh + sg) + 40, bw, 56, '编码结果（每个词一个向量）', { bg: C.blue, size: 16 }),
    arrow('a-e2', [[ex + bw / 2, encTop + 4 * (sh + sg) + 8], [ex + bw / 2, encTop + 4 * (sh + sg) + 40]]),
    ...box('dec-in', dx, 150, bw, 46, '已生成的译文（右移一位）', { bg: C.grey, size: 16 }),
    ...box('dec-emb', dx, 226, bw, 56, '词嵌入 + 正弦位置编码', { size: 16 }),
    arrow('a-d0', [[dx + bw / 2, 196], [dx + bw / 2, 226]]),
    ...area('dec-stack', dx - 12, decTop - 20, bw + 24, 6 * (sh + sg) + 28, { color: '#2f9e44' }),
    note('dec-n', dx + bw - 48, decTop - 48, '× 6', { size: 22, color: '#2f9e44' }),
    arrow('a-d1', [[dx + bw / 2, 282], [dx + bw / 2, decTop - 20]]),
    ...stack('dec', dx, decTop, decItems, dnorm),
    ...box('dec-lin', dx, decTop + 6 * (sh + sg) + 40, bw, 46, '线性层 + Softmax', { size: 16 }),
    ...box('dec-out', dx, decTop + 6 * (sh + sg) + 116, bw, 56, '下一个词的概率', { bg: C.green, size: 16 }),
    arrow('a-d2', [[dx + bw / 2, decTop + 6 * (sh + sg) + 8], [dx + bw / 2, decTop + 6 * (sh + sg) + 40]]),
    arrow('a-d3', [[dx + bw / 2, decTop + 6 * (sh + sg) + 86], [dx + bw / 2, decTop + 6 * (sh + sg) + 116]]),
    // Encoder output feeds every decoder layer's cross-attention as K and V.
    arrow('a-kv', [[ex + bw, encTop + 4 * (sh + sg) + 68], [ex + bw + 30, encTop + 4 * (sh + sg) + 68], [ex + bw + 30, decTop + 2 * (sh + sg) + sh / 2], [dx, decTop + 2 * (sh + sg) + sh / 2]], { color: '#1971c2' }),
    note('kv', ex, encTop + 4 * (sh + sg) + 108, '编码结果作为 K、V\n送进解码器的每一层', { size: 16, color: '#1971c2' }),
  ];
  const zx = M.x + 690, zw = 270;
  const zoom = [
    ...area('zoom', zx - 12, 150, zw + 24, 640, { color: '#e8590c', label: '放大：多头注意力' }),
    arrow('a-zoom', [[ex + bw, encTop + sh / 2], [ex + bw + 16, encTop + sh / 2], [ex + bw + 16, 132], [zx + zw / 2, 132], [zx + zw / 2, 150]], { color: '#e8590c', dashed: true }),
    ...box('z-qkv', zx, 196, zw, 46, 'Q　K　V', { size: 18, family: 3 }),
    ...box('z-proj', zx, 272, zw, 70, '各自线性投影\n分成 h = 8 份', { bg: C.orange, size: 16 }),
    ...box('z-attn', zx, 372, zw, 150, '每一份做\n缩放点积注意力\nsoftmax(QKᵀ / √dₖ) · V', { bg: C.yellow, size: 16 }),
    ...box('z-cat', zx, 552, zw, 56, '8 份结果拼接', { size: 16 }),
    ...box('z-lin', zx, 638, zw, 56, '再做一次线性变换', { size: 16 }),
    note('z-why', zx, 712, '不同的头能同时关注\n不同位置、不同关系', { size: 15, color: MUTED }),
    arrow('z-a0', [[zx + zw / 2, 242], [zx + zw / 2, 272]]),
    arrow('z-a1', [[zx + zw / 2, 342], [zx + zw / 2, 372]]),
    arrow('z-a2', [[zx + zw / 2, 522], [zx + zw / 2, 552]]),
    arrow('z-a3', [[zx + zw / 2, 608], [zx + zw / 2, 638]]),
  ];
  const evidence = [
    ...area('ev', R.x - 14, 110, R.w + 28, 900, { label: '证据：效果、成本和消融' }),
    ...box('res', R.x, 150, R.w, 150, '翻译效果\nWMT14 英→德：28.4 BLEU\n比此前最好结果（含集成模型）\n高出 2 BLEU 以上', { bg: C.purple }),
    ...box('cost', R.x, 330, R.w, 130, '训练成本\n8 块 P100 GPU\n基础模型约 12 小时，大模型 3.5 天', { bg: C.white }),
    ...box('abl', R.x, 490, R.w, 150, '消融实验\n只用 1 个头比最佳设置差 0.9 BLEU\n头太多效果也会下降', { bg: C.white }),
    ...box('gen', R.x, 670, R.w, 130, '能否推广\n英语成分句法分析上也取得好结果', { bg: C.white }),
    arrow('a-me', [[M.x + M.w + 14, 225], [R.x - 14, 225]]),
  ];
  const impact = [
    ...area('end', L.x - 14, 1050, width + 28, 150, { label: '影响与局限' }),
    ...box('impact', L.x, 1090, 640, 80, '影响：成为 BERT、GPT 等模型的基础架构', { bg: C.green, size: 18 }),
    ...box('limit', 680, 1090, 640, 80, '局限：自注意力的计算量随序列长度平方增长', { bg: C.grey, size: 18 }),
    ...box('oneline', 1360, 1090, width - 1360, 80, '一句话：用可并行的注意力替代循环', { bg: C.yellow, size: 18 }),
  ];
  return { title: 'Transformer 论文拆解', steps: [skeleton, background, [...model, ...zoom], [...evidence, ...impact]] };
}

// 入门：一个 Pull Request 怎么合并（宣传片开头手绘、由 Agent 补全的同一个流程）
export function prFlowZh() {
  const y0 = 150, h = 76, w = 200, gap = 80;
  const xs = [0, 1, 2, 3].map(i => i * (w + gap));
  const mid = y0 + h / 2;
  const skeleton = [
    ...area('sheet', -40, -40, xs[3] + w + 80, 500),
    note('title', 0, 0, '一个 PR 是怎么合并的', { size: 40 }),
    note('subtitle', 0, 58, '四个步骤，两条回头路', { size: 18, color: MUTED }),
  ];
  const flow = [
    ...box('n0', xs[0], y0, w, h, '提交 PR', { size: 20 }),
    ...box('n1', xs[1], y0, w, h, '自动检查', { bg: C.yellow, size: 20 }),
    ...box('n2', xs[2], y0, w, h, '代码评审', { bg: C.blue, size: 20 }),
    ...box('n3', xs[3], y0, w, h, '合并', { size: 20, shape: 'ellipse', bg: C.green }),
    arrow('e0', [[xs[0] + w, mid], [xs[1], mid]]),
    arrow('e1', [[xs[1] + w, mid], [xs[2], mid]]),
    arrow('e2', [[xs[2] + w, mid], [xs[3], mid]]),
    note('e1-l', xs[1] + w + 10, mid - 30, '通过', { size: 15, color: MUTED }),
    note('e2-l', xs[2] + w + 10, mid - 30, '批准', { size: 15, color: MUTED }),
    ...box('f1', xs[1], y0 + 170, w, 70, '检查失败：\n修好再推送', { bg: C.red, size: 17 }),
    ...box('f2', xs[2], y0 + 170, w, 70, '要求修改：\n更新代码', { bg: C.orange, size: 17 }),
    arrow('b1', [[xs[1] + w / 2 - 30, y0 + h], [xs[1] + w / 2 - 30, y0 + 170]], { color: '#e8590c' }),
    arrow('b1r', [[xs[1] + w / 2 + 30, y0 + 170], [xs[1] + w / 2 + 30, y0 + h]], { color: MUTED, dashed: true }),
    arrow('b2', [[xs[2] + w / 2 - 30, y0 + h], [xs[2] + w / 2 - 30, y0 + 170]], { color: '#e8590c' }),
    // 改过的代码要重新过一遍检查。
    arrow('b2r', [[xs[2], y0 + 205], [xs[1] + w + 40, y0 + 205], [xs[1] + w + 40, y0 + h + 20], [xs[1] + w, y0 + h + 20]], { color: MUTED, dashed: true }),
  ];
  return { title: 'PR 合并流程', steps: [skeleton, flow] };
}

export const allCases = () => [prFlowZh(), statements(), transformer(), sunzi()];
