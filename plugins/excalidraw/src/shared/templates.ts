import { sceneSchema, type Scene } from './schemas.js';
import { GAP, TONES, edge, elementDefaults, measure, type Tone } from './elements.js';

/**
 * Starter diagrams ("presets"). Pure data, shared by the server (`create_drawing` with a
 * template) and the App (new drawing from a template, insert into the canvas). Nodes carry
 * their label inside the shape and arrows are bound at both ends, like the skill asks of
 * agent drawings, so a template moves and edits like a hand-made diagram.
 */
export const TEMPLATE_IDS = ['flowchart', 'architecture', 'mindmap', 'sequence', 'kanban', 'matrix'] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];
export type TemplateLocale = 'zh-CN' | 'en';

type Shape = 'rectangle' | 'ellipse' | 'diamond';
type Box = { id: string; type: Shape; x: number; y: number; width: number; height: number };
type Options = { locale?: TemplateLocale; idPrefix?: string; x?: number; y?: number };

const zh = {
  flowchart: { name: '流程图', start: '开始', step: '处理请求', check: '是否通过？', fix: '修正后重试', done: '完成', yes: '是', no: '否' },
  architecture: { name: '系统架构', client: '客户端', web: 'Web 应用', mobile: '移动端', service: '服务层', gateway: 'API 网关', app: '业务服务', data: '数据层', db: '数据库', cache: '缓存' },
  mindmap: { name: '思维导图', topic: '核心主题', a: '目标', b: '现状', c: '方案', d: '风险' },
  sequence: { name: '时序图', user: '用户', client: '前端', server: '服务端', m1: '1. 点击登录', m2: '2. POST /login', m3: '3. 返回 token', m4: '4. 显示结果' },
  kanban: { name: '看板', todo: '待办', doing: '进行中', done: '已完成', c1: '梳理需求', c2: '设计方案', c3: '开发功能', c4: '项目启动' },
  matrix: { name: '优先级矩阵', q1: '重要且紧急\n马上做', q2: '重要不紧急\n计划做', q3: '紧急不重要\n委派', q4: '不重要不紧急\n暂缓', x: '紧急程度 →', y: '重要程度 →' },
};

const en: typeof zh = {
  flowchart: { name: 'Flowchart', start: 'Start', step: 'Handle request', check: 'Passed?', fix: 'Fix and retry', done: 'Done', yes: 'Yes', no: 'No' },
  architecture: { name: 'Architecture', client: 'Clients', web: 'Web app', mobile: 'Mobile', service: 'Services', gateway: 'API gateway', app: 'App service', data: 'Data', db: 'Database', cache: 'Cache' },
  mindmap: { name: 'Mind map', topic: 'Main topic', a: 'Goals', b: 'Today', c: 'Options', d: 'Risks' },
  sequence: { name: 'Sequence', user: 'User', client: 'Frontend', server: 'Server', m1: '1. Click sign in', m2: '2. POST /login', m3: '3. Return token', m4: '4. Show result' },
  kanban: { name: 'Kanban', todo: 'To do', doing: 'Doing', done: 'Done', c1: 'Gather needs', c2: 'Design', c3: 'Build feature', c4: 'Kick-off' },
  matrix: { name: 'Priority matrix', q1: 'Important, urgent\nDo now', q2: 'Important, not urgent\nPlan', q3: 'Urgent, not important\nDelegate', q4: 'Neither\nDrop', x: 'Urgency →', y: 'Importance →' },
};

const LABELS: Record<TemplateLocale, typeof zh> = { 'zh-CN': zh, en };

export function templateName(id: TemplateId, locale: TemplateLocale = 'en') { return LABELS[locale][id].name; }

/** A template as a complete scene. `idPrefix` keeps IDs unique when inserting into an existing drawing. */
export function templateScene(id: TemplateId, { locale = 'en', idPrefix = '', x = 0, y = 0 }: Options = {}): Scene {
  const b = new Builder(idPrefix, x, y);
  (BUILDERS[id] as (b: Builder, l: unknown) => void)(b, LABELS[locale][id]);
  return sceneSchema.parse({ elements: b.elements, appState: { viewBackgroundColor: '#ffffff' }, files: {} });
}

const BUILDERS: { [K in TemplateId]: (b: Builder, l: typeof zh[K]) => void } = {
  flowchart(b, l) {
    const start = b.node('start', 'ellipse', 40, 0, 180, 70, l.start, 'green');
    const step = b.node('step', 'rectangle', 40, 130, 180, 80, l.step, 'blue');
    const check = b.node('check', 'diamond', 20, 270, 220, 130, l.check, 'yellow');
    const fix = b.node('fix', 'rectangle', 340, 130, 180, 80, l.fix, 'red');
    const done = b.node('done', 'ellipse', 40, 470, 180, 70, l.done, 'green');
    b.arrow('start-step', start, step);
    b.arrow('step-check', step, check);
    b.arrow('check-done', check, done, l.yes);
    b.arrow('check-fix', check, fix, l.no);
    b.arrow('fix-step', fix, step);
  },
  architecture(b, l) {
    const layers: [string, string, Tone, [string, string][]][] = [
      ['client', l.client, 'blue', [['web', l.web], ['mobile', l.mobile]]],
      ['service', l.service, 'violet', [['gateway', l.gateway], ['app', l.app]]],
      ['data', l.data, 'green', [['db', l.db], ['cache', l.cache]]],
    ];
    const nodes: Record<string, Box> = {};
    layers.forEach(([id, label, tone, items], row) => {
      const top = row * 170;
      b.area(`${id}-layer`, 0, top, 560, 130, tone);
      b.text(`${id}-title`, 16, top + 10, label, 16, TONES[tone][0]);
      items.forEach(([key, text], col) => { nodes[key] = b.node(key, 'rectangle', 130 + col * 220, top + 35, 170, 70, text, tone); });
    });
    b.arrow('web-gateway', nodes.web, nodes.gateway);
    b.arrow('mobile-gateway', nodes.mobile, nodes.gateway);
    b.arrow('gateway-app', nodes.gateway, nodes.app);
    b.arrow('app-db', nodes.app, nodes.db);
    b.arrow('app-cache', nodes.app, nodes.cache);
  },
  mindmap(b, l) {
    const topic = b.node('topic', 'ellipse', 210, 150, 200, 90, l.topic, 'violet');
    const spots: [string, string, number, number, Tone][] = [
      ['a', l.a, 0, 20, 'blue'], ['b', l.b, 460, 20, 'green'], ['c', l.c, 0, 290, 'yellow'], ['d', l.d, 460, 290, 'red'],
    ];
    for (const [id, text, x, y, tone] of spots) b.arrow(`topic-${id}`, topic, b.node(id, 'rectangle', x, y, 160, 70, text, tone), undefined, false);
  },
  sequence(b, l) {
    const actors = [['user', l.user], ['client', l.client], ['server', l.server]] as const;
    const centers = actors.map(([id, text], i) => {
      const box = b.node(id, 'rectangle', i * 240, 0, 160, 60, text, i === 0 ? 'gray' : 'blue');
      b.line(`${id}-life`, box.x + 80, box.y + 68, 340);
      return box.x + 80;
    });
    const messages: [string, number, number, string, boolean][] = [
      ['m1', 0, 1, l.m1, false], ['m2', 1, 2, l.m2, false], ['m3', 2, 1, l.m3, true], ['m4', 1, 0, l.m4, true],
    ];
    messages.forEach(([id, from, to, text, reply], i) => b.message(id, centers[from], centers[to], 120 + i * 70, text, reply));
  },
  kanban(b, l) {
    const columns: [string, string, Tone, [string, string][]][] = [
      ['todo', l.todo, 'gray', [['c1', l.c1], ['c2', l.c2]]],
      ['doing', l.doing, 'yellow', [['c3', l.c3]]],
      ['done', l.done, 'green', [['c4', l.c4]]],
    ];
    columns.forEach(([id, title, tone, cards], col) => {
      const left = col * 230;
      b.area(`${id}-column`, left, 0, 210, 380, 'gray');
      b.node(`${id}-head`, 'rectangle', left + 15, 15, 180, 50, title, tone);
      cards.forEach(([key, text], i) => b.node(key, 'rectangle', left + 15, 85 + i * 90, 180, 70, text, 'yellow', 'sticky'));
    });
  },
  matrix(b, l) {
    const cells: [string, string, number, number, Tone][] = [
      ['q2', l.q2, 0, 0, 'blue'], ['q1', l.q1, 250, 0, 'red'], ['q4', l.q4, 0, 170, 'gray'], ['q3', l.q3, 250, 170, 'yellow'],
    ];
    for (const [id, text, x, y, tone] of cells) b.node(id, 'rectangle', x + 40, y, 230, 150, text, tone);
    b.axis('x-axis', 40, 340, 480, 0); b.text('x-label', 410, 348, l.x, 16, TONES.gray[0]);
    b.axis('y-axis', 20, 320, 0, -320); b.text('y-label', -30, -36, l.y, 16, TONES.gray[0]);
  },
};

/** Lays out elements with hand-drawn defaults, bound labels and bound arrows. */
class Builder {
  elements: Record<string, unknown>[] = [];
  private byId = new Map<string, Record<string, unknown>>();
  constructor(private prefix: string, private dx: number, private dy: number) {}

  private add(element: Record<string, unknown>) {
    const id = String(element.id);
    const full = { ...elementDefaults(id), ...element };
    this.elements.push(full); this.byId.set(id, full);
    return full;
  }
  private bind(id: string, child: { id: string; type: 'text' | 'arrow' }) {
    (this.byId.get(id)!.boundElements as unknown[]).push(child);
  }
  private label(container: string, cx: number, cy: number, text: string, fontSize: number) {
    const { width, height } = measure(text, fontSize);
    this.text(`${container}-label`, cx - width / 2 - this.dx, cy - height / 2 - this.dy, text, fontSize, TONES.gray[0], container);
  }

  text(key: string, x: number, y: number, text: string, fontSize = 20, color: string = TONES.gray[0], containerId?: string) {
    const id = this.prefix + key;
    const { width, height } = measure(text, fontSize);
    this.add({ id, type: 'text', x: x + this.dx, y: y + this.dy, width, height, strokeColor: color, text, originalText: text,
      fontSize, fontFamily: 1, lineHeight: 1.25, textAlign: containerId ? 'center' : 'left', verticalAlign: containerId ? 'middle' : 'top',
      containerId: containerId ?? null, autoResize: true });
    if (containerId) this.bind(containerId, { id, type: 'text' });
  }
  node(key: string, type: Shape, x: number, y: number, width: number, height: number, text: string, tone: Tone, style?: 'sticky'): Box {
    const id = this.prefix + key;
    const [stroke, fill] = TONES[tone];
    const box = { id, type, x: x + this.dx, y: y + this.dy, width, height };
    this.add({ ...box, strokeColor: style === 'sticky' ? TONES.gray[0] : stroke, backgroundColor: fill,
      strokeWidth: style === 'sticky' ? 1 : 2, roundness: type === 'rectangle' ? { type: 3 } : { type: 2 } });
    this.label(id, box.x + width / 2, box.y + height / 2, text, 20);
    return box;
  }
  /** A tinted background region (architecture layer, kanban column); not a container. */
  area(key: string, x: number, y: number, width: number, height: number, tone: Tone) {
    this.add({ id: this.prefix + key, type: 'rectangle', x: x + this.dx, y: y + this.dy, width, height,
      strokeColor: TONES[tone][0], backgroundColor: TONES[tone][1], opacity: 35, strokeStyle: 'dashed', roundness: { type: 3 } });
  }
  arrow(key: string, from: Box, to: Box, text?: string, head = true) {
    const id = this.prefix + key;
    const start = edge(from, to), end = edge(to, from);
    this.add({ id, type: 'arrow', x: start[0], y: start[1], width: Math.abs(end[0] - start[0]), height: Math.abs(end[1] - start[1]),
      points: [[0, 0], [end[0] - start[0], end[1] - start[1]]], lastCommittedPoint: null, roundness: { type: 2 },
      startBinding: { elementId: from.id, focus: 0, gap: GAP }, endBinding: { elementId: to.id, focus: 0, gap: GAP },
      startArrowhead: null, endArrowhead: head ? 'arrow' : null, elbowed: false });
    this.bind(from.id, { id, type: 'arrow' }); this.bind(to.id, { id, type: 'arrow' });
    if (text) this.label(id, (start[0] + end[0]) / 2, (start[1] + end[1]) / 2, text, 16);
  }
  /** A sequence message between lifelines; replies are dashed. Lifelines are lines, which arrows cannot bind to. */
  message(key: string, fromX: number, toX: number, y: number, text: string, reply: boolean) {
    const id = this.prefix + key;
    const left = Math.min(fromX, toX) + this.dx;
    this.add({ id, type: 'arrow', x: fromX + this.dx, y: y + this.dy, width: Math.abs(toX - fromX), height: 0,
      points: [[0, 0], [toX - fromX, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null,
      startArrowhead: null, endArrowhead: 'arrow', elbowed: false, strokeStyle: reply ? 'dashed' : 'solid', strokeColor: TONES.blue[0] });
    const { width, height } = measure(text, 16);
    this.text(`${key}-text`, left + (Math.abs(toX - fromX) - width) / 2 - this.dx, y - height - 6, text, 16);
  }
  line(key: string, x: number, y: number, length: number) {
    this.add({ id: this.prefix + key, type: 'line', x: x + this.dx, y: y + this.dy, width: 0, height: length,
      points: [[0, 0], [0, length]], lastCommittedPoint: null, startBinding: null, endBinding: null,
      startArrowhead: null, endArrowhead: null, strokeStyle: 'dashed', strokeWidth: 1, strokeColor: TONES.gray[0] });
  }
  axis(key: string, x: number, y: number, w: number, h: number) {
    this.add({ id: this.prefix + key, type: 'arrow', x: x + this.dx, y: y + this.dy, width: Math.abs(w), height: Math.abs(h),
      points: [[0, 0], [w, h]], lastCommittedPoint: null, startBinding: null, endBinding: null,
      startArrowhead: null, endArrowhead: 'arrow', elbowed: false, strokeColor: TONES.gray[0] });
  }
}

type Loose = Record<string, unknown>;

/**
 * Copy a saved scene to a new place: every element ID gets `idPrefix` (and every reference to it:
 * labels, bindings, groups, frames), and the scene's top-left corner moves to `x`/`y`.
 * Used to insert a user's own template next to what is already drawn.
 */
export function relocateScene(scene: Scene, { idPrefix = '', x, y }: { idPrefix?: string; x?: number; y?: number } = {}): Scene {
  const live = scene.elements.filter(e => !e.isDeleted);
  const left = live.length ? Math.min(...live.map(e => e.x)) : 0;
  const top = live.length ? Math.min(...live.map(e => e.y)) : 0;
  const dx = x === undefined ? 0 : x - left, dy = y === undefined ? 0 : y - top;
  const ids = new Set(live.map(e => e.id));
  const id = (value: unknown) => typeof value === 'string' && ids.has(value) ? idPrefix + value : value;
  const binding = (value: unknown) => value && typeof value === 'object' ? { ...value as Loose, elementId: id((value as Loose).elementId) } : value;
  const elements = live.map(element => {
    const e = element as Loose;
    return { ...e, id: idPrefix + element.id, x: element.x + dx, y: element.y + dy,
      ...(e.containerId ? { containerId: id(e.containerId) } : {}),
      ...(e.frameId ? { frameId: id(e.frameId) } : {}),
      ...(Array.isArray(e.boundElements) ? { boundElements: (e.boundElements as Loose[]).filter(b => ids.has(b.id as string)).map(b => ({ ...b, id: id(b.id) })) } : {}),
      ...(Array.isArray(e.groupIds) && idPrefix ? { groupIds: (e.groupIds as string[]).map(g => idPrefix + g) } : {}),
      ...('startBinding' in e ? { startBinding: binding(e.startBinding) } : {}),
      ...('endBinding' in e ? { endBinding: binding(e.endBinding) } : {}),
    };
  });
  return sceneSchema.parse({ ...scene, elements });
}

/** Keep a scene's structure and colours but replace every text with a numbered placeholder, for a reusable template. */
export function withPlaceholders(scene: Scene, locale: TemplateLocale = 'en'): Scene {
  let count = 0;
  const elements = scene.elements.map(element => {
    if (element.type !== 'text' || element.isDeleted) return element;
    const text = locale === 'zh-CN' ? `[文字 ${++count}]` : `[Text ${++count}]`;
    return { ...element, text, originalText: text };
  });
  return sceneSchema.parse({ ...scene, elements });
}
