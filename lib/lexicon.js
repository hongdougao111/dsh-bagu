/**
 * 词表与基线数字。
 *
 * 每一条都标了出处。没有出处的数字不写进来 —— 凭感觉估的不算数。
 *
 * 来源代号：
 *   v2ex    V2EX《你们是怎么一眼看出对方发的是 AI 写的？》46 条回复
 *           https://global.v2ex.co/t/1233121
 *   ali     《去不掉的 AI 味儿》 https://developer.aliyun.com/article/1764611
 *   cass    《智能写作的AI味问题》 http://ling.cass.cn/news/xuejie/202607/t20260703_6057568.html
 *   wiki    Wikipedia:Signs of AI writing
 *           https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
 *   fishtone dsh-fish-tone 的语料实测（10 万条真人评论 vs 2180 条 AI 评论）
 *           https://github.com/MX3a48c5/dsh-fish-tone
 *   bili1   BV1xLn46zEgM 猫娘草稿法
 *   bili2   BV1Fbxj6UELR 鱼八股是什么
 *   bili3   BV163xB6zEwF 怎么说话让用户更喜欢你
 */

/** 中文里几乎只在 AI 笔下出现的词。来源：v2ex #18 #25，#12 */
export const AI_WORDS = [
  '掰开了',
  '揉碎了',
  '拆解',
  '深扒',
  '扒一扒',
  '底层逻辑',
  '一句话总结',
  '值得注意',
  '不难看出',
  '由此可见',
  '综上所述',
  '总而言之',
  '总的来说',
  '赋能',
  '抓手',
  '闭环',
  '颗粒度',
  '对齐',
  '拉通',
  '联动',
  '生态位',
  '心智',
];

/** 开头就总结。来源：v2ex #16 #23，fishtone 结构表 roadmap */
export const SUMMARY_OPENERS = [
  '总之',
  '总的来说',
  '综上',
  '由此可见',
  '先说结论',
  '一句话说明白',
  '不绕弯子',
  '直接说结论',
];

/** 否定对仗。来源：v2ex #12 #16 #24 #32 #42，wiki negative parallelism */
export const NEGATION_FRAMES = [
  /不是[^。！？\n]{1,24}(?:而是|，\s*(?:这|那|它|就)?是)/g,
  /不仅[^。！？\n]{1,24}(?:更|还|而且)/g,
  /与其[^。！？\n]{1,20}不如/g,
  /看似[^。！？\n]{1,20}实则/g,
];

/** 假提升、给事加光。来源：wiki fake significance，v2ex #11 */
export const FAKE_SIGNIFICANCE = [
  '标志着',
  '象征着',
  '堪称',
  '不失为',
  '意义深远',
  '具有重要',
  '起到了',
  '充分发挥',
  '是一个缩影',
  '是典范',
  '留下深刻印象',
];

/** 抽象空转词。一篇文章里占比高，就说明它在说事之外还在撑场面。 */
export const ABSTRACT_NOUNS = [
  '意义',
  '价值',
  '本质',
  '趋势',
  '生态',
  '体系',
  '逻辑',
  '维度',
  '层面',
  '格局',
  '范式',
  '内核',
  '底层',
  '根源',
  '边界',
  '认知',
  '能力',
  '方向',
  '路径',
  '打法',
];

/** 评价性形容词。说得越满，越像评职称。 */
export const EVAL_ADJECTIVES = [
  '重要',
  '关键',
  '核心',
  '深刻',
  '全面',
  '独特',
  '优秀',
  '出色',
  '丰富',
  '生动',
  '有趣',
  '精彩',
  '清晰',
  '完整',
  '严谨',
];

/**
 * 留白词。真人约 2/千字，一段里一个都没有 = 句句在下断言。
 * 来源：fishtone 微标记表（真人 0.41~0.70/千字，AI 0.08~0.24/千字）
 */
export const HEDGE_WORDS = [
  '好像',
  '应该',
  '感觉',
  '可能',
  '大概',
  '说不准',
  '也许',
  '估计',
  '似乎',
  '不确定',
  '不是很',
  '我猜',
];

/**
 * 具体性信号：只有真的在说事的人才给得出的东西。
 * 「可替换」的反面。来源：bili2「八股的问题不是礼貌，是可替换」
 */
export const CONCRETE_MARKERS = {
  /** 数字、百分比、金额、版本号、端口 */
  number: /\d+(?:\.\d+)?(?:\s*(?:%|元|块|个|条|行|秒|分钟|小时|天|次|倍|G|M|K|ms|px))?/g,
  /** 时间点 */
  time: /(?:今天|昨天|前天|刚才|刚刚|上次|上回|那天|早上|中午|晚上|凌晨|半夜|\d{1,2}[:：]\d{2})/g,
  /** 第一人称经历。中间允许夹时间词：「我昨天试了」也算 */
  experience: /我[^，。！？\n]{0,4}(?:试过|试了|踩过|踩了|遇到|遇过|看过|看了|听过|听了|吃过|跑了|改过|改了|写过|写了|弄过|折腾|干过|做过|去过)/g,
  /** 感官、身体 */
  sense: /(?:看见|听到|闻|摸|尝|痛|酸|烫|凉|冷|热|饿|困|累|味道|声音|手感)/g,
  /** 引号里的原话、书名号、代码 */
  quoted: /(?:「[^」]{1,40}」|"[^"]{1,40}"|《[^》]{1,40}》|`[^`]{1,40}`)/g,
  /** 具体到能指认的东西：路径、命令、英文标识符 */
  ident: /(?:[A-Za-z_][A-Za-z0-9_.\-]{2,}|\/[\w.\-/]{3,})/g,
};

/** 结构腔。per1k 取自 fishtone 的 10 万条真人评论实测。 */
export const STRUCTURE_FRAMES = [
  { id: 'negation', name: '不是X而是Y', per1k: 0.06, re: /不是[^。！？\n]{1,24}(?:而是|，\s*(?:这|那|它|就)?是)/g },
  { id: 'most', name: '最…的是', per1k: 0.05, re: /最[^，。\n]{1,8}的是/g },
  { id: 'firstThen', name: '先…再…', per1k: 0.01, re: /先[^，。\n]{1,10}再/g },
  { id: 'triple', name: '三段并列', per1k: 0.23, re: /[^，。、\s]{2,8}、[^，。、\s]{2,8}、[^，。、\s]{2,8}/g },
  { id: 'emdash', name: '破折号', per1k: 0.22, re: /——+|—/g },
  { id: 'roadmap', name: '首先/其次/综上', per1k: 0.5, re: /(?:首先|其次|综上所述|总而言之)/g },
  { id: 'yue', name: '越…越', per1k: 0.16, re: /越[^，。\n]{1,8}越/g },
];

/** 文体基线与判定词。来源：fishtone judge.js 的 REGISTERS（10 万条真人评论实测） */
export const REGISTERS = {
  chat: { label: '闲聊', per1k: 0.8 },
  note: { label: '随手记', per1k: 1.3 },
  explain: { label: '解释', per1k: 2.0 },
  argue: { label: '论证', per1k: 2.4 },
  steps: { label: '步骤', per1k: 2.6 },
};

/** 真人留白词密度（每千字）。来源：fishtone 微标记表 */
export const HEDGE_BASELINE = 2.0;

/** 留白词低于这条线就报「句句在下断言」。 */
export const HEDGE_FLOOR = 0.5;
