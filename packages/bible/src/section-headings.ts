/**
 * Pericope / section titles for reader layout.
 * Keyed by OSIS `Book.chapter`; each entry starts at `verse`.
 * Titles are editorial (not part of licensed verse text).
 */

export type SectionHeading = {
  verse: number;
  title: Record<"zh" | "en" | "ja", string>;
};

const H = (
  verse: number,
  zh: string,
  en: string,
  ja: string,
): SectionHeading => ({ verse, title: { zh, en, ja } });

/** Sparse but useful headings for common reading chapters. */
const HEADINGS: Record<string, SectionHeading[]> = {
  "Gen.1": [H(1, "创造天地", "The Creation", "天地創造")],
  "Gen.2": [H(1, "第七日", "The Seventh Day", "第七日"), H(4, "伊甸园", "The Garden of Eden", "エデンの園")],
  "Gen.3": [H(1, "人的堕落", "The Fall", "堕落")],
  "Exod.20": [H(1, "十诫", "The Ten Commandments", "十戒")],
  "Ps.1": [H(1, "义人与恶人", "The Two Ways", "二つの道")],
  "Ps.23": [H(1, "耶和华是我的牧者", "The Lord Is My Shepherd", "主はわが牧者")],
  "Isa.53": [H(1, "受苦的仆人", "The Suffering Servant", "苦しむしもべ")],
  "Matt.1": [
    H(1, "耶稣基督的家谱", "The Genealogy of Jesus", "イエスの系図"),
    H(18, "耶稣基督的降生", "The Birth of Jesus", "イエスの誕生"),
  ],
  "Matt.2": [
    H(1, "博士来朝", "The Visit of the Magi", "博士たちの訪問"),
    H(13, "逃往埃及", "Flight to Egypt", "エジプトへの逃避"),
    H(19, "从埃及回拿撒勒", "Return to Nazareth", "ナザレへの帰還"),
  ],
  "Matt.3": [
    H(1, "施洗约翰传道", "John the Baptist", "バプテスマのヨハネ"),
    H(13, "耶稣受洗", "The Baptism of Jesus", "イエスのバプテスマ"),
  ],
  "Matt.4": [
    H(1, "受试探", "The Temptation", "誘惑"),
    H(12, "在加利利传道", "Ministry in Galilee", "ガリラヤでの宣教"),
    H(18, "呼召门徒", "Calling the First Disciples", "最初の弟子たち"),
  ],
  "Matt.5": [
    H(1, "登山宝训", "The Sermon on the Mount", "山上の垂訓"),
    H(3, "八福", "The Beatitudes", "八福"),
    H(13, "盐和光", "Salt and Light", "塩と光"),
    H(17, "成全律法", "Fulfilling the Law", "律法を成就する"),
    H(21, "论发怒", "Anger", "怒りについて"),
    H(27, "论奸淫", "Adultery", "姦淫について"),
    H(31, "论休妻", "Divorce", "離婚について"),
    H(33, "论起誓", "Oaths", "誓いについて"),
    H(38, "论报复", "Retaliation", "報復について"),
    H(43, "论爱仇敌", "Love for Enemies", "敵を愛する"),
  ],
  "Matt.6": [
    H(1, "论施舍", "Giving to the Needy", "施しについて"),
    H(5, "论祷告", "Prayer", "祈りについて"),
    H(16, "论禁食", "Fasting", "断食について"),
    H(19, "天上的财宝", "Treasures in Heaven", "天に宝を"),
    H(25, "不要忧虑", "Do Not Be Anxious", "思い悩むな"),
  ],
  "Matt.7": [
    H(1, "不要论断", "Judging Others", "さばいてはならない"),
    H(7, "祈求就得着", "Ask, Seek, Knock", "求めよ、探せ、叩け"),
    H(13, "窄门", "The Narrow Gate", "狭い門"),
    H(15, "假先知", "False Prophets", "偽預言者"),
    H(24, "两个盖房子的人", "Two Builders", "二つの家"),
  ],
  "Matt.28": [
    H(1, "复活", "The Resurrection", "復活"),
    H(16, "大使命", "The Great Commission", "大宣教命令"),
  ],
  "Mark.1": [
    H(1, "福音的起头", "The Beginning of the Gospel", "福音の初め"),
    H(9, "耶稣受洗与受试探", "Baptism and Temptation", "バプテスマと誘惑"),
    H(14, "传福音呼召门徒", "Proclaiming the Gospel", "福音の宣教"),
    H(21, "在会堂赶鬼", "Teaching with Authority", "権威ある教え"),
    H(29, "治病赶鬼", "Healings", "癒し"),
    H(35, "在加利利传道", "Preaching in Galilee", "ガリラヤでの宣教"),
  ],
  "Mark.4": [
    H(1, "撒种的比喻", "The Parable of the Sower", "種まきのたとえ"),
    H(35, "平静风浪", "Jesus Calms a Storm", "嵐を静める"),
  ],
  "Mark.5": [
    H(1, "格拉森被鬼附的人", "The Gerasene Demoniac", "ゲラサの悪霊憑き"),
    H(21, "睚鲁的女儿与血漏妇人", "Jairus’s Daughter and a Sick Woman", "ヤイロの娘と病気の女"),
  ],
  "Luke.1": [
    H(1, "序言", "Prologue", "序文"),
    H(5, "施洗约翰出生的预告", "Birth of John Foretold", "ヨハネの誕生予告"),
    H(26, "耶稣降生的预告", "Birth of Jesus Foretold", "イエスの誕生予告"),
    H(39, "马利亚问安伊利莎白", "Mary Visits Elizabeth", "マリアの訪問"),
    H(57, "施洗约翰出生", "Birth of John", "ヨハネの誕生"),
  ],
  "Luke.2": [
    H(1, "耶稣降生", "The Birth of Jesus", "イエスの誕生"),
    H(8, "牧羊人与天使", "Shepherds and Angels", "羊飼いと御使い"),
    H(22, "献与主", "Jesus Presented at the Temple", "神殿での奉献"),
    H(41, "十二岁的耶稣", "The Boy Jesus in the Temple", "神殿の少年イエス"),
  ],
  "Luke.15": [
    H(1, "失羊的比喻", "The Lost Sheep", "失われた羊"),
    H(8, "失钱的比喻", "The Lost Coin", "失われた銀貨"),
    H(11, "浪子的比喻", "The Prodigal Son", "放蕩息子"),
  ],
  "Acts.1": [
    H(1, "升天的应许", "The Promise of the Spirit", "御霊の約束"),
    H(12, "补选使徒", "Matthias Chosen", "マッテヤの選出"),
  ],
  "Acts.2": [
    H(1, "五旬节", "Pentecost", "五旬節"),
    H(14, "彼得讲道", "Peter’s Sermon", "ペテロの説教"),
    H(37, "三千人信主", "Three Thousand Believe", "三千人の回心"),
    H(42, "教会生活", "The Fellowship of Believers", "信者の交わり"),
  ],
  "Acts.9": [
    H(1, "扫罗归主", "The Conversion of Saul", "サウロの回心"),
    H(32, "彼得在吕大和约帕", "Peter in Lydda and Joppa", "ペテロの働き"),
  ],
  "John.1": [
    H(1, "道成了肉身", "The Word Became Flesh", "言が肉となった"),
    H(19, "施洗约翰的见证", "The Testimony of John", "ヨハネの証し"),
    H(35, "耶稣呼召门徒", "Jesus Calls the First Disciples", "最初の弟子たち"),
  ],
  "John.2": [
    H(1, "迦拿婚宴", "The Wedding at Cana", "カナの婚礼"),
    H(13, "洁净圣殿", "Cleansing the Temple", "神殿を清める"),
  ],
  "John.3": [
    H(1, "与尼哥底母谈道", "Nicodemus", "ニコデモ"),
    H(16, "神爱世人", "God So Loved the World", "神は世を愛された"),
    H(22, "约翰再见证", "John’s Further Testimony", "ヨハネのさらなる証"),
  ],
  "John.4": [
    H(1, "撒玛利亚妇人", "The Samaritan Woman", "サマリアの女"),
    H(43, "治好大臣的儿子", "Healing the Official’s Son", "役人の息子を癒す"),
  ],
  "John.5": [
    H(1, "毕士大池旁", "The Pool of Bethesda", "ベテスダの池"),
    H(19, "子从父所作的事", "The Son and the Father", "子と父"),
  ],
  "John.6": [
    H(1, "五饼二鱼", "Feeding the Five Thousand", "五千人の給食"),
    H(16, "海上行走", "Walking on Water", "水の上を歩く"),
    H(22, "生命的粮", "The Bread of Life", "命のパン"),
  ],
  "John.10": [
    H(1, "好牧人", "The Good Shepherd", "良い羊飼い"),
    H(22, "修殿节", "At the Feast of Dedication", "宮清めの祭"),
  ],
  "John.11": [
    H(1, "拉撒路复活", "The Raising of Lazarus", "ラザロの復活"),
    H(45, "杀害耶稣的阴谋", "The Plot to Kill Jesus", "イエス殺害の陰謀"),
  ],
  "John.13": [
    H(1, "洗脚", "Washing the Disciples’ Feet", "足洗い"),
    H(21, "预言被卖", "Jesus Foretells His Betrayal", "裏切りの予告"),
    H(31, "新命令", "A New Commandment", "新しい戒め"),
  ],
  "John.14": [
    H(1, "安慰门徒", "Comfort for the Disciples", "弟子たちへの慰め"),
    H(15, "应许保惠师", "Promise of the Spirit", "助け主の約束"),
  ],
  "John.15": [H(1, "真葡萄树", "The True Vine", "まことのぶどうの木")],
  "John.17": [H(1, "大祭司的祷告", "The High Priestly Prayer", "大祭司の祈り")],
  "John.19": [
    H(1, "受审与钉十字架", "Trial and Crucifixion", "裁判と十字架"),
    H(28, "成了", "It Is Finished", "成し遂げられた"),
    H(38, "安葬", "Burial", "埋葬"),
  ],
  "John.20": [
    H(1, "空坟墓", "The Empty Tomb", "空の墓"),
    H(19, "向门徒显现", "Jesus Appears to the Disciples", "弟子たちへの顕現"),
    H(24, "多马", "Thomas", "トマス"),
  ],
  "John.21": [
    H(1, "提比哩亚海边", "Breakfast by the Sea", "ティベリアス湖畔"),
    H(15, "喂养我的羊", "Feed My Sheep", "わたしの羊を養いなさい"),
  ],
  "Rom.8": [
    H(1, "随从圣灵", "Life in the Spirit", "御霊による命"),
    H(18, "将来的荣耀", "Future Glory", "来るべき栄光"),
    H(31, "神若帮助我们", "God Is for Us", "神が味方なら"),
  ],
  "1Cor.13": [H(1, "爱的颂歌", "The Way of Love", "愛の賛歌")],
  "Rev.21": [H(1, "新天新地", "New Heaven and New Earth", "新しい天と新しい地")],
};

export function sectionHeadingsFor(
  book: string,
  chapter: number,
): SectionHeading[] {
  const key = `${book}.${chapter}`;
  const rows = HEADINGS[key];
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => a.verse - b.verse);
}
