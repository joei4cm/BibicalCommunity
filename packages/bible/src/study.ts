export type StudyLicense = "public-domain" | "cc-by" | "cc-by-sa" | "cc0" | "open";

export interface StudyMaterial {
  id: string;
  title: string;
  url: string;
  license: StudyLicense;
  language?: "zh" | "en" | "ja";
}

/** Stub catalog of open / freely linkable study materials. */
export const STUDY_CATALOG: StudyMaterial[] = [
  {
    id: "net-notes",
    title: "NET Bible Notes (sample)",
    url: "https://netbible.org/",
    license: "open",
    language: "en",
  },
  {
    id: "treasury-scripture",
    title: "Treasury of Scripture Knowledge",
    url: "https://www.biblestudytools.com/concordances/treasury-of-scripture-knowledge/",
    license: "public-domain",
    language: "en",
  },
  {
    id: "matthew-henry",
    title: "Matthew Henry Commentary",
    url: "https://www.ccel.org/ccel/henry/mhc.html",
    license: "public-domain",
    language: "en",
  },
  {
    id: "easton-dict",
    title: "Easton's Bible Dictionary",
    url: "https://www.ccel.org/e/easton/ebd/ebd.html",
    license: "public-domain",
    language: "en",
  },
  {
    id: "openbible-crossrefs",
    title: "OpenBible Cross References",
    url: "https://www.openbible.info/labs/cross-references/",
    license: "cc-by",
    language: "en",
  },
  {
    id: "cbeta-zh-sample",
    title: "公开领域经文研读索引（中文入口）",
    url: "https://www.biblegateway.com/passage/?search=John+1&version=CUVS",
    license: "open",
    language: "zh",
  },
  {
    id: "fhl-study",
    title: "信望爱圣经工具",
    url: "https://bible.fhl.net/",
    license: "open",
    language: "zh",
  },
  {
    id: "ja-wing",
    title: "聖書 口語訳（研究リンク）",
    url: "https://www.bible.com/bible/1819/JHN.1.口語訳",
    license: "open",
    language: "ja",
  },
  {
    id: "ja-wiki-source",
    title: "文語訳聖書（公開情報）",
    url: "https://ja.wikisource.org/wiki/文語訳聖書",
    license: "public-domain",
    language: "ja",
  },
];

export interface DevotionMaterial {
  id: string;
  title: Record<"zh-CN" | "en" | "ja", string>;
  steps: Array<"pause" | "read" | "reflect" | "pray" | "act">;
  body: Record<"zh-CN" | "en" | "ja", string>;
  license: StudyLicense;
}

export const DEVOTION_MATERIALS: DevotionMaterial[] = [
  {
    id: "morning-examen",
    title: {
      "zh-CN": "晨更省察",
      en: "Morning Examen",
      ja: "朝の省察",
    },
    steps: ["pause", "read", "reflect", "pray", "act"],
    body: {
      "zh-CN": "安静片刻，求主光照。读今日经文，默想主对你说什么，以感恩与代求回应，并定下今日一步践行。",
      en: "Be still. Read today’s passage. Reflect on what Christ reveals. Respond in prayer. Choose one concrete act of love.",
      ja: "静まり、今日の聖句を読み、主の語りかけを黙想し、祈りをもって応え、愛の一歩を選びます。",
    },
    license: "cc0",
  },
  {
    id: "lectio-breve",
    title: {
      "zh-CN": "简短圣言诵读",
      en: "Brief Lectio Divina",
      ja: "短い聖読",
    },
    steps: ["pause", "read", "reflect", "pray"],
    body: {
      "zh-CN": "缓慢朗读两遍经文，留意触动你的词句，向主倾诉，静默聆听。",
      en: "Read the text slowly twice. Notice a word that stirs you. Speak to God, then listen in silence.",
      ja: "聖句をゆっくり二度読み、心に残る言葉に気づき、神に語り、沈黙のうちに聴きます。",
    },
    license: "cc0",
  },
  {
    id: "evening-examen",
    title: {
      "zh-CN": "晚祷省察",
      en: "Evening Examen",
      ja: "夜の省察",
    },
    steps: ["pause", "read", "reflect", "pray"],
    body: {
      "zh-CN": "回顾今日蒙恩与软弱，读一节安慰经文，将忧虑交给主，以感恩结束。",
      en: "Review the day’s gifts and struggles. Read a comforting verse. Entrust worries to God and close with thanksgiving.",
      ja: "一日の恵みと弱さを振り返り、慰めの聖句を読み、思い煩いを主に委ね、感謝をもって終わります。",
    },
    license: "cc0",
  },
  {
    id: "psalm-prayer",
    title: {
      "zh-CN": "诗篇祈祷",
      en: "Psalm Prayer",
      ja: "詩篇の祈り",
    },
    steps: ["pause", "read", "pray", "act"],
    body: {
      "zh-CN": "选一首诗篇慢读，把其中的呼求化作你自己的祷告，并决定一项回应行动。",
      en: "Pray a psalm slowly. Make its cry your own, then choose one responsive action.",
      ja: "詩篇をゆっくり祈り読み、その叫びを自分の祈りとし、応答の一歩を選びます。",
    },
    license: "cc0",
  },
  {
    id: "weekly-review",
    title: {
      "zh-CN": "周复盘灵修",
      en: "Weekly Review",
      ja: "週次の振り返り",
    },
    steps: ["pause", "read", "reflect", "pray", "act"],
    body: {
      "zh-CN": "回顾本周经文脉络，记下主的提醒，为下周定下读经与爱邻舍的具体计划。",
      en: "Trace the week’s readings. Note what God highlighted. Plan next week’s reading and one act of neighbor-love.",
      ja: "一週間の聖句の流れを振り返り、主の促しを記し、来週の読書と隣人愛の一歩を計画します。",
    },
    license: "cc0",
  },
];

export function listDevotionMaterials(): DevotionMaterial[] {
  return DEVOTION_MATERIALS;
}

export function listStudyMaterials(filter?: { language?: "zh" | "en" | "ja" }): StudyMaterial[] {
  if (!filter?.language) return STUDY_CATALOG;
  return STUDY_CATALOG.filter((m) => !m.language || m.language === filter.language);
}
