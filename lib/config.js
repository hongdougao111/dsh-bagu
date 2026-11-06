/**
 * 配置：读写插件目录的 config.json，热生效。
 *
 * 存在插件自己的目录里（不放全局 settings.yaml），这样插件删了配置也跟着走。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONFIG_FILE = join(HERE, '..', 'config.json');

export const DEFAULTS = {
  /** 整节系统提示挂不挂 */
  enabled: true,
  /** 只要「查」，不挂 prompt 那一节的话设 false */
  prompt: true,
  /** 严格模式：破折号、只有评价没有具体东西，这些也打回 */
  strict: false,
  /** prompt 节的 order，越大越靠后 */
  order: 921,
  /** 留白词低于这个密度（每千字）就报「句句在下断言」 */
  hedgeFloor: 0.2,
  /** 结构腔超过基线几倍才报 */
  structureTimes: 3,
  /** 具体物低于每百字这个数就报 */
  concreteFloor: 0.6,
  /** 梗库：内置 6792 条，默认开 —— 这是「会玩梗」的底座 */
  memes: true,
  /** 每轮请求前自动查词库并注入。关掉就只在主动调工具时查。 */
  autoMeme: true,
  /** 手动接管玩梗尺度。关着时交给模型自己判断。 */
  toneSwitch: false,
  /** 玩梗尺度 0-100。toneSwitch 关着时不生效。 */
  toneLevel: 50,
  /**
   * AI 接梗：让模型根据族提示拼一句具体的接话。
   *
   * 默认关 —— 开了就每条都要调一次模型，要 API key、要付 token。
   * 养鱼那种要质量的场景可以开；日常聊天不值得。
   */
  aiBridge: false,
  /** 另配接口开关：默认走会话模型，这个开着才用下面三项 */
  aiUseOwn: false,
  /** AI 接梗用的 baseUrl/model/key。aiUseOwn 关着时不看这些。 */
  aiBaseUrl: '',
  aiModel: '',
  aiApiKey: '',
};

export function readConfig() {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(patch) {
  const cur = readConfig();
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULTS)) continue;
    if (typeof DEFAULTS[k] === 'boolean') next[k] = Boolean(v);
    else if (typeof DEFAULTS[k] === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) next[k] = n;
    }
  }
  // order 夹一下，别把别人的节顶飞
  next.order = Math.min(999, Math.max(1, Math.round(next.order)));
  // 阈值不许为负
  next.hedgeFloor = Math.max(0, next.hedgeFloor);
  next.structureTimes = Math.max(1, next.structureTimes);
  next.concreteFloor = Math.max(0, next.concreteFloor);

  try {
    mkdirSync(dirname(CONFIG_FILE), { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch {
    /* 只读环境就只在内存里生效 */
  }
  return next;
}
