/**
 * Pericope / section titles for reader layout.
 * Keyed by OSIS `Book.chapter`; each entry starts at `verse`.
 * Titles are editorial (not part of licensed verse text).
 */

import { getBook } from "./books.js";

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
  // —— Expanded coverage (gospels / Acts / letters / OT samples) ——
  "Gen.6": [H(1, "人的败坏", "Human Wickedness", "人の堕落"), H(9, "挪亚方舟", "Noah’s Ark", "ノアの箱舟")],
  "Gen.12": [H(1, "召亚伯拉罕", "Call of Abram", "アブラムの召命")],
  "Gen.22": [H(1, "献以撒", "Abraham Tested", "イサク奉献")],
  "Exod.3": [H(1, "荆棘火焰中的呼召", "The Burning Bush", "燃えるしばの中の召命")],
  "Exod.14": [H(1, "过红海", "Crossing the Red Sea", "紅海を渡る")],
  "Ruth.1": [H(1, "路得随拿俄米", "Naomi and Ruth", "ルツとナオミ")],
  "1Sam.17": [H(1, "大卫与歌利亚", "David and Goliath", "ダビデとゴリアテ")],
  "Ps.51": [H(1, "求神怜悯", "Create in Me a Clean Heart", "清い心を")],
  "Ps.91": [H(1, "安居在神翅膀下", "My Refuge and Fortress", "いと高き方の隠れ場")],
  "Ps.119": [H(1, "遵行主道的福乐", "Blessed Are the Blameless", "みことばに生きる")],
  "Prov.1": [H(1, "智慧的开端", "The Beginning of Knowledge", "知恵の初め")],
  "Prov.3": [H(1, "专心仰赖耶和华", "Trust in the Lord", "主に信頼せよ")],
  "Isa.6": [H(1, "以赛亚见异象", "Isaiah’s Vision", "イザヤの幻")],
  "Isa.9": [H(1, "奇妙策士", "For to Us a Child Is Born", "ひとりのみどりご")],
  "Isa.40": [H(1, "安慰我的百姓", "Comfort My People", "慰めよ、わが民を")],
  "Dan.3": [H(1, "火窑中的三人", "The Fiery Furnace", "燃える炉")],
  "Dan.6": [H(1, "但以理在狮子坑", "Daniel in the Lions’ Den", "ライオンの穴")],
  "Jon.1": [H(1, "约拿逃避使命", "Jonah Flees", "ヨナの逃走")],
  "Jon.2": [H(1, "鱼腹中的祷告", "Jonah’s Prayer", "ヨナの祈り")],
  "Mic.6": [H(1, "耶和华所要的", "What the Lord Requires", "主が求めておられること")],
  "Mal.3": [H(1, "使者来临", "The Messenger of the Covenant", "契約の使者")],
  "Matt.8": [H(1, "洁净长大麻风的", "Jesus Cleanses a Leper", "らい病人を清める"), H(23, "平静风浪", "Jesus Calms a Storm", "嵐を静める")],
  "Matt.9": [H(1, "医治瘫子", "Jesus Heals a Paralytic", "中風の人を癒す"), H(9, "呼召马太", "Call of Matthew", "マタイの召命")],
  "Matt.13": [H(1, "天国的比喻", "Parables of the Kingdom", "天の国のたとえ")],
  "Matt.14": [H(1, "五饼二鱼", "Feeding the Five Thousand", "五千人の給食"), H(22, "海上行走", "Walking on Water", "水の上を歩く")],
  "Matt.16": [H(13, "彼得认耶稣为基督", "Peter Confesses Christ", "ペテロの信仰告白"), H(21, "预言受难", "Jesus Foretells His Death", "死の予告")],
  "Matt.17": [H(1, "登山变像", "The Transfiguration", "変貌")],
  "Matt.18": [H(1, "天国里谁为大", "Who Is the Greatest?", "だれがいちばん偉いか"), H(21, "饶恕七十个七次", "Forgiveness", "赦し")],
  "Matt.21": [H(1, "骑驴进耶路撒冷", "Triumphal Entry", "エルサレム入城"), H(12, "洁净圣殿", "Cleansing the Temple", "神殿を清める")],
  "Matt.24": [H(1, "末世的预兆", "Signs of the End", "終末の徴")],
  "Matt.25": [H(1, "十个童女", "Ten Virgins", "十人のおとめ"), H(14, "按才干受托", "Parable of the Talents", "タラントのたとえ"), H(31, "分别绵羊山羊", "Sheep and Goats", "羊と山羊")],
  "Matt.26": [H(1, "阴谋与膏抹", "Plot to Kill Jesus", "殺害の陰謀"), H(26, "设立圣餐", "The Lord’s Supper", "主の晩餐"), H(36, "客西马尼", "Gethsemane", "ゲツセマネ")],
  "Matt.27": [H(1, "受审与钉十字架", "Trial and Crucifixion", "裁判と十字架"), H(57, "安葬", "Burial", "埋葬")],
  "Mark.2": [H(1, "医治瘫子", "Jesus Heals a Paralytic", "中風の人を癒す"), H(13, "呼召利未", "Call of Levi", "レビの召命")],
  "Mark.3": [H(1, "安息日治病", "Healing on the Sabbath", "安息日の癒し"), H(13, "选立十二使徒", "The Twelve Apostles", "十二使徒")],
  "Mark.6": [H(1, "拿撒勒厌弃耶稣", "Rejected at Nazareth", "ナザレでの拒否"), H(30, "五饼二鱼", "Feeding the Five Thousand", "五千人の給食"), H(45, "海上行走", "Walking on Water", "水の上を歩く")],
  "Mark.8": [H(27, "彼得认基督", "Peter Confesses Christ", "ペテロの信仰告白"), H(31, "预言受难", "Jesus Foretells His Death", "死の予告")],
  "Mark.9": [H(1, "登山变像", "The Transfiguration", "変貌")],
  "Mark.10": [H(13, "给小孩子按手", "Let the Children Come", "子供たちを迎えよ"), H(17, "少年财主", "The Rich Young Man", "富める青年"), H(46, "瞎子巴底买", "Blind Bartimaeus", "バルテマイ")],
  "Mark.11": [H(1, "进耶路撒冷", "Triumphal Entry", "エルサレム入城"), H(15, "洁净圣殿", "Cleansing the Temple", "神殿を清める")],
  "Mark.14": [H(1, "阴谋与膏抹", "Plot and Anointing", "陰謀と香油"), H(22, "设立圣餐", "The Lord’s Supper", "主の晩餐"), H(32, "客西马尼", "Gethsemane", "ゲツセマネ")],
  "Mark.15": [H(1, "受审与钉十字架", "Trial and Crucifixion", "裁判と十字架"), H(42, "安葬", "Burial", "埋葬")],
  "Mark.16": [H(1, "复活", "The Resurrection", "復活")],
  "Luke.3": [H(1, "施洗约翰传道", "John the Baptist", "バプテスマのヨハネ"), H(21, "耶稣受洗", "Baptism of Jesus", "イエスのバプテスマ")],
  "Luke.4": [H(1, "受试探", "The Temptation", "誘惑"), H(16, "拿撒勒会堂", "Rejected at Nazareth", "ナザレでの拒否")],
  "Luke.5": [H(1, "得人如得鱼", "Calling the First Disciples", "最初の弟子たち"), H(17, "医治瘫子", "Jesus Heals a Paralytic", "中風の人を癒す")],
  "Luke.6": [H(20, "论福与祸", "Blessings and Woes", "幸いと災い"), H(27, "论爱仇敌", "Love Your Enemies", "敵を愛する")],
  "Luke.10": [H(1, "七十人受差遣", "The Seventy-Two", "七十人の派遣"), H(25, "好撒玛利亚人", "The Good Samaritan", "善いサマリヤ人"), H(38, "马大与马利亚", "Martha and Mary", "マルタとマリヤ")],
  "Luke.11": [H(1, "主祷文", "The Lord’s Prayer", "主の祈り")],
  "Luke.12": [H(13, "无知的财主", "The Rich Fool", "愚かな富者"), H(22, "不要忧虑", "Do Not Be Anxious", "思い悩むな")],
  "Luke.19": [H(1, "撒该", "Zacchaeus", "ザアカイ"), H(28, "进耶路撒冷", "Triumphal Entry", "エルサレム入城")],
  "Luke.22": [H(1, "逾越节与圣餐", "The Last Supper", "最後の晩餐"), H(39, "橄榄山祷告", "Mount of Olives", "オリーブ山")],
  "Luke.23": [H(1, "受审与钉十字架", "Trial and Crucifixion", "裁判と十字架"), H(50, "安葬", "Burial", "埋葬")],
  "Luke.24": [H(1, "空坟墓", "The Empty Tomb", "空の墓"), H(13, "往以马忤斯", "Road to Emmaus", "エマオへの道"), H(36, "向门徒显现", "Jesus Appears to the Disciples", "弟子たちへの顕現")],
  "John.7": [H(1, "住棚节", "At the Feast of Booths", "仮庵の祭"), H(37, "活水的江河", "Rivers of Living Water", "生ける水の川")],
  "John.8": [H(1, "行淫时被捉的妇人", "The Woman Caught in Adultery", "姦淫の現場で捕らえられた女"), H(12, "世界的光", "I Am the Light of the World", "世の光")],
  "John.9": [H(1, "生来瞎眼的得看见", "Healing the Man Born Blind", "生まれつきの盲人")],
  "John.12": [H(1, "马利亚膏耶稣", "Mary Anoints Jesus", "マリヤが香油を注ぐ"), H(12, "骑驴进京", "Triumphal Entry", "エルサレム入城")],
  "John.16": [H(1, "圣灵的工作", "The Work of the Spirit", "御霊の働き"), H(16, "忧愁变喜乐", "Your Sorrow Will Turn to Joy", "悲しみが喜びに")],
  "John.18": [H(1, "被捉拿与受审", "Betrayal and Arrest", "裏切りと逮捕")],
  "Acts.3": [H(1, "美门口瘸腿得医治", "The Lame Beggar Healed", "足なえの癒し")],
  "Acts.4": [H(1, "彼得约翰受审", "Peter and John Before the Council", "議会の前で")],
  "Acts.7": [H(1, "司提反的讲论", "Stephen’s Speech", "ステパノの弁明"), H(54, "司提反殉道", "The Stoning of Stephen", "ステパノの殉教")],
  "Acts.8": [H(1, "福音传到撒玛利亚", "Philip in Samaria", "ピリポの伝道"), H(26, "埃提阿伯太监", "The Ethiopian Eunuch", "エチオピアの宦官")],
  "Acts.10": [H(1, "哥尼流信主", "Cornelius", "コルネリオ")],
  "Acts.13": [H(1, "差遣巴拿巴和扫罗", "Barnabas and Saul Sent", "バルナバとサウロの派遣")],
  "Acts.16": [H(1, "提摩太同工", "Timothy Joins Paul", "テモテ"), H(11, "腓立比的事工", "Ministry in Philippi", "ピリピでの働き")],
  "Acts.17": [H(1, "帖撒罗尼迦与雅典", "Thessalonica and Athens", "テサロニケとアテネ")],
  "Acts.27": [H(1, "海上遇险", "Paul’s Voyage to Rome", "ローマへの航海")],
  "Acts.28": [H(1, "抵达罗马", "Paul in Rome", "ローマ到着")],
  "Rom.1": [H(1, "福音的大能", "The Power of the Gospel", "福音の力"), H(18, "神的忿怒", "The Wrath of God", "神の怒り")],
  "Rom.3": [H(21, "因信称义", "Righteousness Through Faith", "信仰による義")],
  "Rom.5": [H(1, "因信得和平", "Peace with God", "神との平和"), H(12, "亚当与基督", "Adam and Christ", "アダムとキリスト")],
  "Rom.6": [H(1, "向罪死向神活", "Dead to Sin, Alive to God", "罪に死に、神に生きる")],
  "Rom.12": [H(1, "献上身体为活祭", "Living Sacrifices", "生きた供え物")],
  "1Cor.1": [H(1, "问安与劝勉合一", "Greeting and Appeal for Unity", "挨拶と一致の勧め")],
  "1Cor.11": [H(23, "设立圣餐", "The Lord’s Supper", "主の晩餐")],
  "1Cor.15": [H(1, "基督复活", "The Resurrection of Christ", "キリストの復活"), H(35, "复活的身体", "The Resurrection Body", "復活のからだ")],
  "2Cor.4": [H(1, "宝贝放在瓦器里", "Treasure in Jars of Clay", "土の器の中の宝")],
  "2Cor.5": [H(1, "住在主里面", "Away from the Body", "主とともに住む"), H(11, "劝人与神和好", "Ministry of Reconciliation", "和解の務め")],
  "Gal.5": [H(1, "基督里的自由", "Freedom in Christ", "キリストにある自由"), H(16, "顺着圣灵而行", "Walk by the Spirit", "御霊によって歩む")],
  "Eph.1": [H(1, "在基督里的属灵福气", "Spiritual Blessings in Christ", "キリストにある祝福")],
  "Eph.2": [H(1, "本是死在过犯罪恶中", "Alive with Christ", "キリストと共に生きる"), H(11, "拆毁隔断的墙", "One in Christ", "キリストにあって一つ")],
  "Eph.6": [H(10, "神所赐的全副军装", "The Armor of God", "神の武具")],
  "Phil.2": [H(1, "以基督的心为心", "Christ’s Example of Humility", "キリストの謙遜")],
  "Phil.4": [H(4, "靠主常常喜乐", "Rejoice in the Lord", "主にあって喜びなさい")],
  "Col.1": [H(15, "基督是首生的", "The Preeminence of Christ", "キリストの優位")],
  "Col.3": [H(1, "求上面的事", "Put On the New Self", "上にあるものを求めよ")],
  "1Thess.4": [H(13, "主再来与复活", "The Coming of the Lord", "主の来臨")],
  "1Tim.2": [H(1, "为万人祈求", "Pray for All People", "すべての人のために祈れ")],
  "2Tim.3": [H(14, "圣经都是神所默示的", "All Scripture Is God-Breathed", "聖書は神の霊感による")],
  "Heb.1": [H(1, "神藉着儿子说话", "The Son Superior to Angels", "御子による啓示")],
  "Heb.11": [H(1, "信心的伟人", "By Faith", "信仰によって")],
  "Heb.12": [H(1, "仰望为我们信心创始成终的耶稣", "Looking to Jesus", "イエスを仰ぎ見よ")],
  "Jas.1": [H(1, "试炼中的喜乐", "Joy in Trials", "試練の中の喜び"), H(19, "听道与行道", "Hearing and Doing", "聞いて行う")],
  "Jas.2": [H(14, "信心与行为", "Faith and Works", "信仰と行い")],
  "1Pet.1": [H(3, "活泼的盼望", "A Living Hope", "生きた望み")],
  "1Pet.2": [H(4, "活石与圣洁祭司", "Living Stones", "生きた石")],
  "1John.1": [H(1, "生命之道", "The Word of Life", "いのちのことば")],
  "1John.4": [H(7, "神就是爱", "God Is Love", "神は愛です")],
  "Rev.1": [H(1, "启示录引言", "Prologue", "序文"), H(9, "人子的异象", "Vision of the Son of Man", "人の子の幻")],
  "Rev.5": [H(1, "七印的书卷", "The Scroll and the Lamb", "巻物と小羊")],
  "Rev.7": [H(9, "各国各方的群众", "A Great Multitude", "大きな群衆")],
  "Rev.12": [H(1, "妇人与龙", "The Woman and the Dragon", "女と竜")],
  "Rev.19": [H(1, "羔羊的婚筵", "The Marriage Supper of the Lamb", "小羊の婚宴"), H(11, "骑白马的", "The Rider on a White Horse", "白い馬に乗る方")],
  "Rev.22": [H(1, "生命水的河", "The River of Life", "いのちの水の川"), H(6, "必快来", "Jesus Is Coming", "すぐに来る")],
};

export function sectionHeadingsFor(
  book: string,
  chapter: number,
): SectionHeading[] {
  const key = `${book}.${chapter}`;
  const rows = HEADINGS[key];
  if (rows?.length) {
    return [...rows].sort((a, b) => a.verse - b.verse);
  }
  // Soft chapter title so prose is never headingless.
  const meta = getBook(book);
  if (!meta) return [];
  const n = Math.max(1, Math.floor(chapter));
  return [
    H(
      1,
      `${meta.name.zh} ${n}`,
      `${meta.name.en} ${n}`,
      `${meta.name.ja} ${n}`,
    ),
  ];
}
