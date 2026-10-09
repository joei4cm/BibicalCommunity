#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
HANDLE="seed$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"SeedPass12345!\",\"nickname\":\"Seeder\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
AUTH="Authorization: Bearer $TOKEN"

put_chapter() {
  local key="$1"
  local body="$2"
  echo "PUT $key"
  curl -sf -X PUT "$BASE/v1/media/put/$key" -H "$AUTH" -H 'content-type: application/json' -d "$body"
  echo
}

# Chinese mainstream (scaffold samples — licensed full corpus via entitlement + R2 pack)
put_chapter "bible/cuvs/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"太初有道，道与神同在，道就是神。"},{"verse":2,"text":"这道太初与神同在。"},{"verse":3,"text":"万物是借着他造的；凡被造的，没有一样不是借着他造的。"},{"verse":14,"text":"道成了肉身，住在我们中间，充充满满地有恩典有真理。"}]}'
put_chapter "bible/cuvt/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"太初有道，道與神同在，道就是神。"},{"verse":2,"text":"這道太初與神同在。"},{"verse":14,"text":"道成了肉身，住在我們中間，充充滿滿地有恩典有真理。"}]}'
put_chapter "bible/rcuv/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"（样例）太初有道，道与神同在，道就是神。"},{"verse":14,"text":"（样例）道成了肉身，住在我们中间。"}]}'
put_chapter "bible/ccb/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"（样例）宇宙被造以前，道已经存在。道与上帝同在；道就是上帝。"},{"verse":14,"text":"（样例）道成为人，住在我们中间。"}]}'
put_chapter "bible/lzz/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"（样例）起初有道，道与上帝同在，道就是上帝。"},{"verse":14,"text":"（样例）道成了肉身，住在我们中间。"}]}'

# Japanese mainstream scaffolds
put_chapter "bible/shinkaiyaku/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"（見本）初めに言があった。言は神とともにあった。言は神であった。"},{"verse":14,"text":"（見本）言は人となって、私たちの間に住まわれた。"}]}'
put_chapter "bible/kougo/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"初めに言があった。言は神と共にあった。言は神であった。"},{"verse":14,"text":"そして言は肉体となり、わたしたちのうちに宿った。"}]}'
put_chapter "bible/shinKyoudou/John.1.json" '{"book":"John","chapter":1,"verses":[{"verse":1,"text":"（見本）初めに言があった。言は神と共にあった。言は神であった。"},{"verse":14,"text":"（見本）言は肉となって、わたしたちの間に宿られた。"}]}'

# John.2 dual-pane scaffolds (zh/ja mainstream local/r2 set)
put_chapter "bible/cuvs/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"第三日，在加利利的迦拿有娶亲的筵席，耶稣的母亲在那里。"},{"verse":11,"text":"这是耶稣所行的头一件神迹，是在加利利的迦拿行的，显出他的荣耀来；他的门徒就信他了。"}]}'
put_chapter "bible/cuvt/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"第三日，在加利利的迦拿有娶親的筵席，耶穌的母親在那裏。"},{"verse":11,"text":"這是耶穌所行的頭一件神蹟，是在加利利的迦拿行的，顯出他的榮耀來；他的門徒就信他了。"}]}'
put_chapter "bible/rcuv/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"第三日，在加利利的迦拿有娶亲的筵席；耶稣的母亲在那里。"},{"verse":11,"text":"这是耶稣所行的头一件神迹，是在加利利的迦拿行的，显出他的荣耀来；他的门徒就信他了。"}]}'
put_chapter "bible/ccb/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"第三天，加利利的迦拿有婚宴，耶稣的母亲也在场。"},{"verse":11,"text":"这是耶稣在加利利的迦拿所行的第一个神迹，显明了他的荣耀；门徒就信了他。"}]}'
put_chapter "bible/lzz/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"第三日，在加利利的迦拿有婚筵；耶稣的母亲在那里。"},{"verse":11,"text":"这是耶稣所行的头一件神迹，是在加利利的迦拿行的，显出他的荣耀来；他的门徒就信了他。"}]}'
put_chapter "bible/kougo/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"三日目に、ガリラヤのカナで婚礼があって、イエスの母がそこにいた。"},{"verse":11,"text":"イエスはこれを最初のしるしとしてガリラヤのカナで行い、その栄光を現された。"}]}'
put_chapter "bible/shinkaiyaku/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"三日目に、ガリラヤのカナで婚宴があり、イエスの母がそこにいた。"},{"verse":11,"text":"イエスはこれを最初のしるしとしてガリラヤのカナで行い、ご自分の栄光を現された。"}]}'
put_chapter "bible/shinKyoudou/John.2.json" '{"book":"John","chapter":2,"verses":[{"verse":1,"text":"三日目に、ガリラヤのカナで婚礼があって、イエスの母がそこにいた。"},{"verse":11,"text":"イエスはこれを最初のしるしとしてガリラヤのカナで行い、その栄光を現された。"}]}'

# John.3 dual-pane scaffolds (zh/ja mainstream; includes 3:16)
put_chapter "bible/cuvs/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"有一个法利赛人，名叫尼哥底母，是犹太人的官。"},{"verse":16,"text":"神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。"}]}'
put_chapter "bible/cuvt/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"有一個法利賽人，名叫尼哥底母，是猶太人的官。"},{"verse":16,"text":"神愛世人，甚至將他的獨生子賜給他們，叫一切信他的，不至滅亡，反得永生。"}]}'
put_chapter "bible/rcuv/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"有一个法利赛人，名叫尼哥底母，是犹太人的官。"},{"verse":16,"text":"神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不致灭亡，反得永生。"}]}'
put_chapter "bible/ccb/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"有一个法利赛人，名叫尼哥德慕，是犹太人的官长。"},{"verse":16,"text":"上帝深爱世人，甚至将他的独生子赐给他们，叫一切信他的人不致灭亡，反得永生。"}]}'
put_chapter "bible/lzz/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"有一个法利赛人，名叫尼哥底母，是犹太人的议员。"},{"verse":16,"text":"上帝这样地爱了世人，甚至将他的独生子赐给他们，叫一切信他的，不至于灭亡，反得永生。"}]}'
put_chapter "bible/kougo/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"さて、パリサイ人のひとりで、その名をニコデモというユダヤ人の指導者があった。"},{"verse":16,"text":"神はそのひとり子を賜ったほどに、この世を愛して下さった。それは御子を信じる者がひとりも滅びないで、永遠の命を得るためである。"}]}'
put_chapter "bible/shinkaiyaku/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"さて、パリサイ人の中にニコデモという人がいた。ユダヤ人の指導者であった。"},{"verse":16,"text":"神は、実に、そのひとり子をお与えになったほどに、世を愛された。それは御子を信じる者が、一人として滅びることなく、永遠のいのちを持つためである。"}]}'
put_chapter "bible/shinKyoudou/John.3.json" '{"book":"John","chapter":3,"verses":[{"verse":1,"text":"さて、ファリサイ派に属する、ニコデモという人がいた。ユダヤ人たちの議員であった。"},{"verse":16,"text":"神は、その独り子をお与えになったほどに、世を愛された。独り子を信じる者が一人も滅びないで、永遠の命を得るためである。"}]}'

for tid in cuvs cuvt rcuv ccb lzz shinkaiyaku kougo shinKyoudou; do
  curl -sf -X POST "$BASE/v1/bible/entitlements" -H "$AUTH" -H 'content-type: application/json' -d "{\"translationId\":\"$tid\"}" >/dev/null
done

echo "CUVS:"
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1" -H "$AUTH" | head -c 220; echo
echo "CUVT:"
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.1" -H "$AUTH" | head -c 220; echo
echo "KOUGO:"
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.1" -H "$AUTH" | head -c 220; echo
echo "SHINKAIYAKU:"
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.1" -H "$AUTH" | head -c 220; echo
echo "John.2 scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.2" -H "$AUTH" | grep -q '迦拿'
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.2" -H "$AUTH" | grep -qE '迦拿|娶親'
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.2" -H "$AUTH" | grep -q '迦拿'
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.2" -H "$AUTH" | grep -qE '迦拿|婚宴'
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.2" -H "$AUTH" | grep -qE '迦拿|婚筵'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.2" -H "$AUTH" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.2" -H "$AUTH" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.2" -H "$AUTH" | grep -q 'カナ'
echo "JOHN2_R2_OK"
echo "John.3 scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.3" -H "$AUTH" | grep -qE '神爱世人|独生子'
echo "JOHN3_R2_OK"

# Multi-book dual-pane scaffolds (Gen.1 / Matt.5 / Ps.23) — short license-safe samples
put_chapter "bible/cuvs/Gen.1.json" '{"book":"Gen","chapter":1,"verses":[{"verse":1,"text":"（样例）起初，神创造天地。"},{"verse":2,"text":"（样例）地是空虚混沌，渊面黑暗；神的灵运行在水面上。"},{"verse":3,"text":"（样例）神说：“要有光”，就有了光。"},{"verse":4,"text":"（样例）神看光是好的，就把光暗分开了。"}]}'
put_chapter "bible/kougo/Gen.1.json" '{"book":"Gen","chapter":1,"verses":[{"verse":1,"text":"（見本）はじめに神は天と地とを創造された。"},{"verse":2,"text":"（見本）地は形なく、むなしく、やみが淵のおもてにあり、神の霊が水のおもてをおおっていた。"},{"verse":3,"text":"（見本）神は「光あれ」と言われた。すると光があった。"},{"verse":4,"text":"（見本）神はその光を見て、良しとされた。神は光とやみとを分けられた。"}]}'
put_chapter "bible/cuvs/Ps.23.json" '{"book":"Ps","chapter":23,"verses":[{"verse":1,"text":"（样例）耶和华是我的牧者，我必不致缺乏。"},{"verse":2,"text":"（样例）他使我躺卧在青草地上，领我在可安歇的水边。"},{"verse":3,"text":"（样例）他使我的灵魂苏醒，为自己的名引导我走义路。"},{"verse":4,"text":"（样例）我虽然行过死荫的幽谷，也不怕遭害，因为你与我同在；你的杖，你的竿，都安慰我。"}]}'
put_chapter "bible/kougo/Ps.23.json" '{"book":"Ps","chapter":23,"verses":[{"verse":1,"text":"（見本）主はわたしの牧者であって、わたしには乏しいことがない。"},{"verse":2,"text":"（見本）主はわたしを緑の牧場に伏させ、憩いの水のほとりに伴われる。"},{"verse":3,"text":"（見本）主はわたしの魂を生きかえらせ、御名のために正しい道に導かれる。"},{"verse":4,"text":"（見本）たといわたしは死の陰の谷を歩むとも、わざわいを恐れません。あなたがわたしと共におられるからです。"}]}'
put_chapter "bible/web/Gen.1.json" '{"book":"Gen","chapter":1,"verses":[{"verse":1,"text":"In the beginning, God created the heavens and the earth."},{"verse":3,"text":"God said, \"Let there be light,\" and there was light."}]}'
put_chapter "bible/web/Matt.5.json" '{"book":"Matt","chapter":5,"verses":[{"verse":1,"text":"Seeing the multitudes, he went up onto a mountain."},{"verse":3,"text":"Blessed are the poor in spirit, for theirs is the Kingdom of Heaven."},{"verse":5,"text":"Blessed are the gentle, for they shall inherit the earth."}]}'
put_chapter "bible/web/Ps.23.json" '{"book":"Ps","chapter":23,"verses":[{"verse":1,"text":"Yahweh is my shepherd: I shall lack nothing."},{"verse":2,"text":"He makes me lie down in green pastures. He leads me beside still waters."},{"verse":4,"text":"Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me."}]}'
put_chapter "bible/kjv/Gen.1.json" '{"book":"Gen","chapter":1,"verses":[{"verse":1,"text":"In the beginning God created the heaven and the earth."},{"verse":3,"text":"And God said, Let there be light: and there was light."}]}'
put_chapter "bible/kjv/Matt.5.json" '{"book":"Matt","chapter":5,"verses":[{"verse":3,"text":"Blessed are the poor in spirit: for theirs is the kingdom of heaven."},{"verse":5,"text":"Blessed are the meek: for they shall inherit the earth."}]}'
put_chapter "bible/kjv/Ps.23.json" '{"book":"Ps","chapter":23,"verses":[{"verse":1,"text":"The LORD is my shepherd; I shall not want."},{"verse":2,"text":"He maketh me to lie down in green pastures: he leadeth me beside the still waters."}]}'
put_chapter "bible/asv/Gen.1.json" '{"book":"Gen","chapter":1,"verses":[{"verse":1,"text":"In the beginning God created the heavens and the earth."},{"verse":3,"text":"And God said, Let there be light: and there was light."}]}'
put_chapter "bible/asv/Matt.5.json" '{"book":"Matt","chapter":5,"verses":[{"verse":3,"text":"Blessed are the poor in spirit: for theirs is the kingdom of heaven."},{"verse":5,"text":"Blessed are the meek: for they shall inherit the earth."}]}'
put_chapter "bible/asv/Ps.23.json" '{"book":"Ps","chapter":23,"verses":[{"verse":1,"text":"Jehovah is my shepherd; I shall not want."},{"verse":2,"text":"He maketh me to lie down in green pastures; He leadeth me beside still waters."}]}'

# Multi-book NT dual-pane scaffolds (Rom.8 / Heb.11) — short license-safe samples
put_chapter "bible/web/Rom.8.json" '{"book":"Rom","chapter":8,"verses":[{"verse":1,"text":"There is therefore now no condemnation to those who are in Christ Jesus, who don'\''t walk according to the flesh, but according to the Spirit."},{"verse":28,"text":"We know that all things work together for good for those who love God, for those who are called according to his purpose."},{"verse":31,"text":"What then shall we say about these things? If God is for us, who can be against us?"}]}'
put_chapter "bible/kjv/Rom.8.json" '{"book":"Rom","chapter":8,"verses":[{"verse":1,"text":"There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit."},{"verse":28,"text":"And we know that all things work together for good to them that love God, to them who are the called according to his purpose."},{"verse":31,"text":"What shall we then say to these things? If God be for us, who can be against us?"}]}'
put_chapter "bible/asv/Rom.8.json" '{"book":"Rom","chapter":8,"verses":[{"verse":1,"text":"There is therefore now no condemnation to them that are in Christ Jesus."},{"verse":28,"text":"And we know that to them that love God all things work together for good, even to them that are called according to his purpose."},{"verse":31,"text":"What then shall we say to these things? If God is for us, who is against us?"}]}'
put_chapter "bible/cuvs/Rom.8.json" '{"book":"Rom","chapter":8,"verses":[{"verse":1,"text":"（样例）如今，那些在基督耶稣里的就不定罪了。"},{"verse":28,"text":"（样例）我们晓得万事都互相效力，叫爱神的人得益处，就是按他旨意被召的人。"},{"verse":31,"text":"（样例）既是这样，还有什么说的呢？神若帮助我们，谁能敌挡我们呢？"}]}'
put_chapter "bible/kougo/Rom.8.json" '{"book":"Rom","chapter":8,"verses":[{"verse":1,"text":"（見本）こういうわけで、今やキリスト・イエスにある者は罪に定められることがない。"},{"verse":28,"text":"（見本）神を愛する人々、すなわち、神のご計画に従って召された人々にとっては、神がすべてのことを働かせて益としてくださることを、わたしたちは知っている。"},{"verse":31,"text":"（見本）それでは、これらのことについて、わたしたちは何と言おうか。神がわたしたちの味方であるなら、だれがわたしたちに敵対できるだろうか。"}]}'
put_chapter "bible/web/Heb.11.json" '{"book":"Heb","chapter":11,"verses":[{"verse":1,"text":"Now faith is assurance of things hoped for, proof of things not seen."},{"verse":2,"text":"For by this, the elders obtained approval."},{"verse":6,"text":"Without faith it is impossible to be well pleasing to him, for he who comes to God must believe that he exists, and that he is a rewarder of those who seek him."}]}'
put_chapter "bible/kjv/Heb.11.json" '{"book":"Heb","chapter":11,"verses":[{"verse":1,"text":"Now faith is the substance of things hoped for, the evidence of things not seen."},{"verse":2,"text":"For by it the elders obtained a good report."},{"verse":6,"text":"But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him."}]}'
put_chapter "bible/asv/Heb.11.json" '{"book":"Heb","chapter":11,"verses":[{"verse":1,"text":"Now faith is assurance of things hoped for, a conviction of things not seen."},{"verse":2,"text":"For therein the elders had witness borne to them."},{"verse":6,"text":"And without faith it is impossible to be well-pleasing unto him; for he that cometh to God must believe that he is, and that he is a rewarder of them that seek after him."}]}'
put_chapter "bible/cuvs/Heb.11.json" '{"book":"Heb","chapter":11,"verses":[{"verse":1,"text":"（样例）信就是所望之事的实底，是未见之事的确据。"},{"verse":2,"text":"（样例）古人在这信上得了美好的证据。"},{"verse":6,"text":"（样例）人非有信，就不能得神的喜悦；因为到神面前来的人必须信有神，且信他赏赐那寻求他的人。"}]}'
put_chapter "bible/kougo/Heb.11.json" '{"book":"Heb","chapter":11,"verses":[{"verse":1,"text":"（見本）信仰とは、望んでいる事がらを確信し、まだ見ていない事実を確認することである。"},{"verse":2,"text":"（見本）昔の人たちは、この信仰のゆえに神に認められた。"},{"verse":6,"text":"（見本）信仰がなくては、神に喜ばれることはできない。神に来る者は、神のいますことと、ご自分を求める者に報いてくださる方であることを、信じなければならない。"}]}'

# Multi-book OT/NT dual-pane scaffolds (Isa.53 / Acts.2) — short license-safe samples
put_chapter "bible/web/Isa.53.json" '{"book":"Isa","chapter":53,"verses":[{"verse":1,"text":"Who has believed our message? To whom has Yahweh'\''s arm been revealed?"},{"verse":5,"text":"But he was pierced for our transgressions. He was crushed for our iniquities. The punishment that brought our peace was on him; and by his wounds we are healed."},{"verse":6,"text":"All we like sheep have gone astray. Everyone has turned to his own way; and Yahweh has laid on him the iniquity of us all."}]}'
put_chapter "bible/kjv/Isa.53.json" '{"book":"Isa","chapter":53,"verses":[{"verse":1,"text":"Who hath believed our report? and to whom is the arm of the LORD revealed?"},{"verse":5,"text":"But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed."},{"verse":6,"text":"All we like sheep have gone astray; we have turned every one to his own way; and the LORD hath laid on him the iniquity of us all."}]}'
put_chapter "bible/asv/Isa.53.json" '{"book":"Isa","chapter":53,"verses":[{"verse":1,"text":"Who hath believed our message? and to whom hath the arm of Jehovah been revealed?"},{"verse":5,"text":"But he was wounded for our transgressions, he was bruised for our iniquities; the chastisement of our peace was upon him; and with his stripes we are healed."},{"verse":6,"text":"All we like sheep have gone astray; we have turned every one to his own way; and Jehovah hath laid on him the iniquity of us all."}]}'
put_chapter "bible/cuvs/Isa.53.json" '{"book":"Isa","chapter":53,"verses":[{"verse":1,"text":"（样例）我们所传的有谁信呢？耶和华的膀臂向谁显露呢？"},{"verse":5,"text":"（样例）哪知他为我们的过犯受害，为我们的罪孽压伤。因他受的刑罚，我们得平安；因他受的鞭伤，我们得医治。"},{"verse":6,"text":"（样例）我们都如羊走迷，各人偏行己路，耶和华使我们众人的罪孽都归在他身上。"}]}'
put_chapter "bible/kougo/Isa.53.json" '{"book":"Isa","chapter":53,"verses":[{"verse":1,"text":"（見本）だれがわれわれの聞いたことを信じ得たか。主の腕は、だれにあらわれたか。"},{"verse":5,"text":"（見本）しかし彼はわたしたちのとがのために傷つけられ、わたしたちの不義のために砕かれた。彼はみずから懲らしめをうけて、わたしたちに平安を与え、その打ち傷によって、わたしたちはいやされた。"},{"verse":6,"text":"（見本）わたしたちはみな羊のように迷って、おのおの自分の道に向かって行った。主はわたしたちすべての者の不義を、彼の上におかれた。"}]}'
put_chapter "bible/web/Acts.2.json" '{"book":"Acts","chapter":2,"verses":[{"verse":1,"text":"Now when the day of Pentecost had come, they were all with one accord in one place."},{"verse":2,"text":"Suddenly there came from the sky a sound like the rushing of a mighty wind, and it filled all the house where they were sitting."},{"verse":4,"text":"They were all filled with the Holy Spirit and began to speak with other languages, as the Spirit gave them the ability to speak."}]}'
put_chapter "bible/kjv/Acts.2.json" '{"book":"Acts","chapter":2,"verses":[{"verse":1,"text":"And when the day of Pentecost was fully come, they were all with one accord in one place."},{"verse":4,"text":"And they were all filled with the Holy Ghost, and began to speak with other tongues, as the Spirit gave them utterance."},{"verse":38,"text":"Then Peter said unto them, Repent, and be baptized every one of you in the name of Jesus Christ for the remission of sins, and ye shall receive the gift of the Holy Ghost."}]}'
put_chapter "bible/asv/Acts.2.json" '{"book":"Acts","chapter":2,"verses":[{"verse":1,"text":"And when the day of Pentecost was now come, they were all together in one place."},{"verse":2,"text":"And suddenly there came from heaven a sound as of the rushing of a mighty wind, and it filled all the house where they were sitting."},{"verse":4,"text":"And they were all filled with the Holy Spirit, and began to speak with other tongues, as the Spirit gave them utterance."}]}'
put_chapter "bible/cuvs/Acts.2.json" '{"book":"Acts","chapter":2,"verses":[{"verse":1,"text":"（样例）五旬节到了，门徒都聚集在一处。"},{"verse":2,"text":"（样例）忽然，从天上有响声下来，好像一阵大风吹过，充满了他们所坐的屋子；"},{"verse":4,"text":"（样例）他们就都被圣灵充满，按着圣灵所赐的口才说起别国的话来。"}]}'
put_chapter "bible/kougo/Acts.2.json" '{"book":"Acts","chapter":2,"verses":[{"verse":1,"text":"（見本）五旬節の日がきて、みんなの者が一緒に集まっていると、"},{"verse":2,"text":"（見本）突然、激しい風が吹いてきたような音が天から起ってきて、一同がすわっていた家いっぱいに響きわたった。"},{"verse":4,"text":"（見本）すると、一同は聖霊に満たされ、御霊が語らせるままに、いろいろの他国の言葉で語り出した。"}]}'

echo "Multi-book scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Gen.1" -H "$AUTH" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Gen.1" -H "$AUTH" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Gen.1" -H "$AUTH" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.5" -H "$AUTH" | grep -qiE 'poor in spirit|Blessed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.5" -H "$AUTH" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.5" -H "$AUTH" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.23" -H "$AUTH" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.23" -H "$AUTH" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.23" -H "$AUTH" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Gen.1" -H "$AUTH" | grep -qE '样例|起初|创造'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Gen.1" -H "$AUTH" | grep -qE '見本|創造|はじめに'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.23" -H "$AUTH" | grep -qE '样例|牧者'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.23" -H "$AUTH" | grep -qE '見本|牧者'
echo "MULTI_BOOK_SCAFFOLD_OK"
echo "Multi-book NT scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Rom.8" -H "$AUTH" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Rom.8" -H "$AUTH" | grep -qiE 'no condemnation|If God be for us'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Rom.8" -H "$AUTH" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Heb.11" -H "$AUTH" | grep -qiE 'faith is assurance|hoped for'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Heb.11" -H "$AUTH" | grep -qiE 'substance of things hoped for|impossible to please'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Heb.11" -H "$AUTH" | grep -qiE 'assurance of things hoped for|conviction'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Rom.8" -H "$AUTH" | grep -qE '样例|不定罪'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Rom.8" -H "$AUTH" | grep -qE '見本|罪に定められることがない'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Heb.11" -H "$AUTH" | grep -qE '样例|信就是|实底'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Heb.11" -H "$AUTH" | grep -qE '見本|信仰とは'
echo "MULTI_BOOK_NT_OK"
echo "Multi-book OT/NT scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Isa.53" -H "$AUTH" | grep -qiE 'believed our message|pierced for our transgressions|wounds we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Isa.53" -H "$AUTH" | grep -qiE 'believed our report|wounded for our transgressions|stripes we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Isa.53" -H "$AUTH" | grep -qiE 'believed our message|wounded for our transgressions|sheep have gone astray'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Acts.2" -H "$AUTH" | grep -qiE 'Pentecost|Holy Spirit'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Acts.2" -H "$AUTH" | grep -qiE 'Pentecost|Holy Ghost|Repent'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Acts.2" -H "$AUTH" | grep -qiE 'Pentecost|Holy Spirit|mighty wind'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Isa.53" -H "$AUTH" | grep -qE '样例|我们所传的|鞭伤'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Isa.53" -H "$AUTH" | grep -qE '見本|信じ得たか|主の腕'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Acts.2" -H "$AUTH" | grep -qE '样例|五旬节'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Acts.2" -H "$AUTH" | grep -qE '見本|五旬節'
echo "MULTI_BOOK_OTNT_OK"

# Multi-book wisdom dual-pane scaffolds (Ps.1 / Prov.3) — short license-safe samples
put_chapter "bible/web/Ps.1.json" '{"book":"Ps","chapter":1,"verses":[{"verse":1,"text":"Blessed is the man who doesn'\''t walk in the counsel of the wicked, nor stand on the path of sinners, nor sit in the seat of scoffers;"},{"verse":2,"text":"but his delight is in Yahweh'\''s law. On his law he meditates day and night."},{"verse":3,"text":"He will be like a tree planted by the streams of water, that produces its fruit in its season, whose leaf also does not wither. Whatever he does shall prosper."},{"verse":4,"text":"The wicked are not so, but are like the chaff which the wind drives away."}]}'
put_chapter "bible/kjv/Ps.1.json" '{"book":"Ps","chapter":1,"verses":[{"verse":1,"text":"Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful."},{"verse":2,"text":"But his delight is in the law of the LORD; and in his law doth he meditate day and night."},{"verse":3,"text":"And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper."},{"verse":4,"text":"The ungodly are not so: but are like the chaff which the wind driveth away."}]}'
put_chapter "bible/asv/Ps.1.json" '{"book":"Ps","chapter":1,"verses":[{"verse":1,"text":"Blessed is the man that walketh not in the counsel of the wicked, Nor standeth in the way of sinners, Nor sitteth in the seat of scoffers:"},{"verse":2,"text":"But his delight is in the law of Jehovah; And on his law doth he meditate day and night."},{"verse":3,"text":"And he shall be like a tree planted by the streams of water, That bringeth forth its fruit in its season, Whose leaf also doth not wither; And whatsoever he doeth shall prosper."},{"verse":4,"text":"The wicked are not so, But are like the chaff which the wind driveth away."}]}'
put_chapter "bible/cuvs/Ps.1.json" '{"book":"Ps","chapter":1,"verses":[{"verse":1,"text":"（样例）不从恶人的计谋，不站罪人的道路，不坐亵慢人的座位，"},{"verse":2,"text":"（样例）惟喜爱耶和华的律法，昼夜思想，这人便为有福！"},{"verse":3,"text":"（样例）他要像一棵树栽在溪水旁，按时候结果子，叶子也不枯干。凡他所做的尽都顺利。"},{"verse":4,"text":"（样例）恶人并不是这样，乃像糠秕被风吹散。"}]}'
put_chapter "bible/kougo/Ps.1.json" '{"book":"Ps","chapter":1,"verses":[{"verse":1,"text":"（見本）悪しき者のはかりごとに歩まず、罪びとの道に立たず、あざける者の座にすわらぬ人はさいわいである。"},{"verse":2,"text":"（見本）このような人は主のおきてをよろこび、昼も夜もそのおきてを思う。"},{"verse":3,"text":"（見本）このような人は流れのほとりに植えられた木のごとく、時がくれば実を結び、その葉もしぼまない。そのなすところは皆栄える。"},{"verse":4,"text":"（見本）悪しき者はそうでない、風の吹き去るもみがらのようだ。"}]}'
put_chapter "bible/web/Prov.3.json" '{"book":"Prov","chapter":3,"verses":[{"verse":1,"text":"My son, don'\''t forget my teaching; but let your heart keep my commandments:"},{"verse":5,"text":"Trust in Yahweh with all your heart, and don'\''t lean on your own understanding."},{"verse":6,"text":"In all your ways acknowledge him, and he will make your paths straight."},{"verse":7,"text":"Don'\''t be wise in your own eyes. Fear Yahweh, and depart from evil."}]}'
put_chapter "bible/kjv/Prov.3.json" '{"book":"Prov","chapter":3,"verses":[{"verse":1,"text":"My son, forget not my law; but let thine heart keep my commandments:"},{"verse":5,"text":"Trust in the LORD with all thine heart; and lean not unto thine own understanding."},{"verse":6,"text":"In all thy ways acknowledge him, and he shall direct thy paths."},{"verse":7,"text":"Be not wise in thine own eyes: fear the LORD, and depart from evil."}]}'
put_chapter "bible/asv/Prov.3.json" '{"book":"Prov","chapter":3,"verses":[{"verse":1,"text":"My son, forget not my law; But let thy heart keep my commandments:"},{"verse":5,"text":"Trust in Jehovah with all thy heart, And lean not upon thine own understanding:"},{"verse":6,"text":"In all thy ways acknowledge him, And he will direct thy paths."},{"verse":7,"text":"Be not wise in thine own eyes; Fear Jehovah, and depart from evil:"}]}'
put_chapter "bible/cuvs/Prov.3.json" '{"book":"Prov","chapter":3,"verses":[{"verse":1,"text":"（样例）我儿，不要忘记我的法则；你心要谨守我的诫命；"},{"verse":5,"text":"（样例）你要专心仰赖耶和华，不可倚靠自己的聪明，"},{"verse":6,"text":"（样例）在你一切所行的事上都要认定他，他必指引你的路。"},{"verse":7,"text":"（样例）不要自以为有智慧；要敬畏耶和华，远离恶事。"}]}'
put_chapter "bible/kougo/Prov.3.json" '{"book":"Prov","chapter":3,"verses":[{"verse":1,"text":"（見本）わが子よ、わたしの教を忘れるな、あなたの心にわたしの戒めを守れ。"},{"verse":5,"text":"（見本）心をつくして主に信頼せよ、自分の知識に頼ってはならない。"},{"verse":6,"text":"（見本）すべての道で主を認めよ、そうすれば、主はあなたの道をまっすぐにされる。"},{"verse":7,"text":"（見本）自分を知恵ある者と考えるな。主を恐れ、悪を離れよ。"}]}'

echo "Multi-book wisdom scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.1" -H "$AUTH" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.1" -H "$AUTH" | grep -qiE 'Blessed is the man|counsel of the ungodly'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.1" -H "$AUTH" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Prov.3" -H "$AUTH" | grep -qiE 'Trust in Yahweh|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Prov.3" -H "$AUTH" | grep -qiE 'Trust in the LORD|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Prov.3" -H "$AUTH" | grep -qiE 'Trust in Jehovah|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.1" -H "$AUTH" | grep -qE '样例|恶人的计谋|有福'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.1" -H "$AUTH" | grep -qE '見本|悪しき者|さいわい'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Prov.3" -H "$AUTH" | grep -qE '样例|仰赖耶和华|自己的聪明'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Prov.3" -H "$AUTH" | grep -qE '見本|主に信頼|自分の知識'
echo "MULTI_BOOK_WISDOM_OK"

# Multi-book law/gospel dual-pane scaffolds (Mark.1 / Exod.20) — short license-safe samples
put_chapter "bible/web/Mark.1.json" '{"book":"Mark","chapter":1,"verses":[{"verse":1,"text":"The beginning of the Good News of Jesus Christ, the Son of God."},{"verse":2,"text":"As it is written in the prophets, \"Behold, I send my messenger before your face, who will prepare your way before you:"},{"verse":3,"text":"the voice of one crying in the wilderness, '\''Make ready the way of the Lord! Make his paths straight!'\''\""},{"verse":4,"text":"John came baptizing in the wilderness and preaching the baptism of repentance for forgiveness of sins."}]}'
put_chapter "bible/kjv/Mark.1.json" '{"book":"Mark","chapter":1,"verses":[{"verse":1,"text":"The beginning of the gospel of Jesus Christ, the Son of God;"},{"verse":2,"text":"As it is written in the prophets, Behold, I send my messenger before thy face, which shall prepare thy way before thee."},{"verse":3,"text":"The voice of one crying in the wilderness, Prepare ye the way of the Lord, make his paths straight."},{"verse":4,"text":"John did baptize in the wilderness, and preach the baptism of repentance for the remission of sins."}]}'
put_chapter "bible/asv/Mark.1.json" '{"book":"Mark","chapter":1,"verses":[{"verse":1,"text":"The beginning of the gospel of Jesus Christ, the Son of God."},{"verse":2,"text":"Even as it is written in Isaiah the prophet, Behold, I send my messenger before thy face, Who shall prepare thy way;"},{"verse":3,"text":"The voice of one crying in the wilderness, Make ye ready the way of the Lord, Make his paths straight;"},{"verse":4,"text":"John came, who baptized in the wilderness and preached the baptism of repentance unto remission of sins."}]}'
put_chapter "bible/cuvs/Mark.1.json" '{"book":"Mark","chapter":1,"verses":[{"verse":1,"text":"（样例）神的儿子，耶稣基督福音的起头。"},{"verse":2,"text":"（样例）正如先知书上记着说：看哪，我要差遣我的使者在你前面，预备道路。"},{"verse":3,"text":"（样例）在旷野有人声喊着说：预备主的道，修直他的路。"},{"verse":4,"text":"（样例）照这话，约翰来了，在旷野施洗，传悔改的洗礼，使罪得赦。"}]}'
put_chapter "bible/kougo/Mark.1.json" '{"book":"Mark","chapter":1,"verses":[{"verse":1,"text":"（見本）神の子イエス・キリストの福音のはじめ。"},{"verse":2,"text":"（見本）預言者イザヤの書にこう書いてある、「見よ、わたしは使いをあなたの前につかわし、あなたの道を整えさせるであろう。"},{"verse":3,"text":"（見本）荒野で呼ばわる者の声がする、『主の道を備えよ、その道筋をまっすぐにせよ』」。"},{"verse":4,"text":"（見本）そのとおりに、バプテスマのヨハネが荒野に現われ、罪のゆるしを得させる悔改めのバプテスマを宣べ伝えた。"}]}'
put_chapter "bible/web/Exod.20.json" '{"book":"Exod","chapter":20,"verses":[{"verse":1,"text":"God spoke all these words, saying,"},{"verse":2,"text":"\"I am Yahweh your God, who brought you out of the land of Egypt, out of the house of bondage."},{"verse":3,"text":"\"You shall have no other gods before me."},{"verse":12,"text":"\"Honor your father and your mother, that your days may be long in the land which Yahweh your God gives you."}]}'
put_chapter "bible/kjv/Exod.20.json" '{"book":"Exod","chapter":20,"verses":[{"verse":1,"text":"And God spake all these words, saying,"},{"verse":2,"text":"I am the LORD thy God, which have brought thee out of the land of Egypt, out of the house of bondage."},{"verse":3,"text":"Thou shalt have no other gods before me."},{"verse":12,"text":"Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee."}]}'
put_chapter "bible/asv/Exod.20.json" '{"book":"Exod","chapter":20,"verses":[{"verse":1,"text":"And God spake all these words, saying,"},{"verse":2,"text":"I am Jehovah thy God, who brought thee out of the land of Egypt, out of the house of bondage."},{"verse":3,"text":"Thou shalt have no other gods before me."},{"verse":12,"text":"Honor thy father and thy mother, that thy days may be long in the land which Jehovah thy God giveth thee."}]}'
put_chapter "bible/cuvs/Exod.20.json" '{"book":"Exod","chapter":20,"verses":[{"verse":1,"text":"（样例）神吩咐这一切的话说："},{"verse":2,"text":"（样例）我是耶和华你的神，曾将你从埃及地为奴之家领出来。"},{"verse":3,"text":"（样例）除了我以外，你不可有别的神。"},{"verse":12,"text":"（样例）当孝敬父母，使你的日子在耶和华你神所赐你的地上得以长久。"}]}'
put_chapter "bible/kougo/Exod.20.json" '{"book":"Exod","chapter":20,"verses":[{"verse":1,"text":"（見本）神はこのすべての言葉を語って言われた、"},{"verse":2,"text":"（見本）「わたしはあなたの神、主であって、あなたをエジプトの地、奴隷の家から導き出した者である。"},{"verse":3,"text":"（見本）あなたはわたしのほかに、なにものをも神としてはならない。"},{"verse":12,"text":"（見本）あなたの父と母を敬え。これはあなたの神、主が賜わる地に、あなたが長く生きるためである。"}]}'

echo "Multi-book law/gospel scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Mark.1" -H "$AUTH" | grep -qiE 'beginning of the Good News|Jesus Christ|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Mark.1" -H "$AUTH" | grep -qiE 'beginning of the gospel|Son of God|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Mark.1" -H "$AUTH" | grep -qiE 'beginning of the gospel|Make ye ready|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Exod.20" -H "$AUTH" | grep -qiE 'Yahweh your God|no other gods|Honor your father'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Exod.20" -H "$AUTH" | grep -qiE 'LORD thy God|no other gods|Honour thy father'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Exod.20" -H "$AUTH" | grep -qiE 'Jehovah thy God|no other gods|Honor thy father'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Mark.1" -H "$AUTH" | grep -qE '样例|耶稣基督|福音的起头'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Mark.1" -H "$AUTH" | grep -qE '見本|イエス・キリスト|福音のはじめ'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Exod.20" -H "$AUTH" | grep -qE '样例|耶和华你的神|不可有别的神'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Exod.20" -H "$AUTH" | grep -qE '見本|エジプトの地|神としてはならない'
echo "MULTI_BOOK_LAW_GOSPEL_OK"

# Multi-book narrative dual-pane scaffolds (Luke.2 / Deut.6) — short license-safe samples
put_chapter "bible/web/Luke.2.json" '{"book":"Luke","chapter":2,"verses":[{"verse":1,"text":"Now in those days, a decree went out from Caesar Augustus that all the world should be enrolled."},{"verse":7,"text":"She gave birth to her firstborn son. She wrapped him in bands of cloth and laid him in a feeding trough, because there was no room for them in the inn."},{"verse":10,"text":"The angel said to them, \"Don'\''t be afraid, for behold, I bring you good news of great joy which will be to all the people."},{"verse":11,"text":"For there is born to you today, in David'\''s city, a Savior, who is Christ the Lord."}]}'
put_chapter "bible/kjv/Luke.2.json" '{"book":"Luke","chapter":2,"verses":[{"verse":1,"text":"And it came to pass in those days, that there went out a decree from Caesar Augustus, that all the world should be taxed."},{"verse":7,"text":"And she brought forth her firstborn son, and wrapped him in swaddling clothes, and laid him in a manger; because there was no room for them in the inn."},{"verse":10,"text":"And the angel said unto them, Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people."},{"verse":11,"text":"For unto you is born this day in the city of David a Saviour, which is Christ the Lord."}]}'
put_chapter "bible/asv/Luke.2.json" '{"book":"Luke","chapter":2,"verses":[{"verse":1,"text":"Now it came to pass in those days, there went out a decree from Caesar Augustus, that all the world should be enrolled."},{"verse":7,"text":"And she brought forth her firstborn son; and she wrapped him in swaddling clothes, and laid him in a manger, because there was no room for them in the inn."},{"verse":10,"text":"And the angel said unto them, Be not afraid; for behold, I bring you good tidings of great joy which shall be to all the people:"},{"verse":11,"text":"for there is born to you this day in the city of David a Saviour, who is Christ the Lord."}]}'
put_chapter "bible/cuvs/Luke.2.json" '{"book":"Luke","chapter":2,"verses":[{"verse":1,"text":"（样例）当那些日子，凯撒奥古斯都有旨意下来，叫天下人民都报名上册。"},{"verse":7,"text":"（样例）就生了头胎的儿子，用布包起来，放在马槽里，因为客店里没有地方。"},{"verse":10,"text":"（样例）那天使对他们说：不要惧怕！我报给你们大喜的信息，是关乎万民的；"},{"verse":11,"text":"（样例）因今天在大卫的城里，为你们生了救主，就是主基督。"}]}'
put_chapter "bible/kougo/Luke.2.json" '{"book":"Luke","chapter":2,"verses":[{"verse":1,"text":"（見本）そのころ、全世界の人口調査をせよとの勅令が、皇帝アウグストから出た。"},{"verse":7,"text":"（見本）初めての子を産み、布にくるんで飼葉おけに寝かせた。宿屋には彼らのいる余地がなかったからである。"},{"verse":10,"text":"（見本）御使が彼らに言った、「恐れるな。見よ、すべての民に与えられる大きな喜びを、あなたがたに伝える。"},{"verse":11,"text":"（見本）きょうダビデの町に、あなたがたのために救主がお生れになった。この方こそ主なるキリストである。"}]}'
put_chapter "bible/web/Deut.6.json" '{"book":"Deut","chapter":6,"verses":[{"verse":4,"text":"Hear, Israel: Yahweh is our God. Yahweh is one."},{"verse":5,"text":"You shall love Yahweh your God with all your heart, with all your soul, and with all your might."},{"verse":6,"text":"These words, which I command you today, shall be on your heart;"},{"verse":7,"text":"and you shall teach them diligently to your children, and shall talk of them when you sit in your house, and when you walk by the way, and when you lie down, and when you rise up."}]}'
put_chapter "bible/kjv/Deut.6.json" '{"book":"Deut","chapter":6,"verses":[{"verse":4,"text":"Hear, O Israel: The LORD our God is one LORD:"},{"verse":5,"text":"And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might."},{"verse":6,"text":"And these words, which I command thee this day, shall be in thine heart:"},{"verse":7,"text":"And thou shalt teach them diligently unto thy children, and shalt talk of them when thou sittest in thine house, and when thou walkest by the way, and when thou liest down, and when thou risest up."}]}'
put_chapter "bible/asv/Deut.6.json" '{"book":"Deut","chapter":6,"verses":[{"verse":4,"text":"Hear, O Israel: Jehovah our God is one Jehovah:"},{"verse":5,"text":"and thou shalt love Jehovah thy God with all thy heart, and with all thy soul, and with all thy might."},{"verse":6,"text":"And these words, which I command thee this day, shall be upon thy heart;"},{"verse":7,"text":"and thou shalt teach them diligently unto thy children, and shalt talk of them when thou sittest in thy house, and when thou walkest by the way, and when thou liest down, and when thou risest up."}]}'
put_chapter "bible/cuvs/Deut.6.json" '{"book":"Deut","chapter":6,"verses":[{"verse":4,"text":"（样例）以色列啊，你要听！耶和华我们神是独一的主。"},{"verse":5,"text":"（样例）你要尽心、尽性、尽力爱耶和华你的神。"},{"verse":6,"text":"（样例）我今日所吩咐你的话都要记在心上，"},{"verse":7,"text":"（样例）也要殷勤教训你的儿女。无论你坐在家里，行在路上，躺下，起来，都要谈论。"}]}'
put_chapter "bible/kougo/Deut.6.json" '{"book":"Deut","chapter":6,"verses":[{"verse":4,"text":"（見本）イスラエルよ、聞け。われわれの神、主は唯一の主である。"},{"verse":5,"text":"（見本）あなたは心をつくし、精神をつくし、力をつくして、あなたの神、主を愛さなければならない。"},{"verse":6,"text":"（見本）きょうわたしがあなたに命じるこれらの言葉をあなたの心に留め、"},{"verse":7,"text":"（見本）努めてこれをあなたの子供たちに教え、あなたが家に座している時も、道を歩く時も、寝る時も、起きる時も、これを語らなければならない。"}]}'

echo "Multi-book narrative scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Luke.2" -H "$AUTH" | grep -qiE 'Caesar Augustus|good news of great joy|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Luke.2" -H "$AUTH" | grep -qiE 'Caesar Augustus|manger|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Luke.2" -H "$AUTH" | grep -qiE 'Caesar Augustus|good tidings|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Deut.6" -H "$AUTH" | grep -qiE 'Hear, Israel|Yahweh is one|love Yahweh your God'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Deut.6" -H "$AUTH" | grep -qiE 'Hear, O Israel|one LORD|love the LORD thy God'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Deut.6" -H "$AUTH" | grep -qiE 'Hear, O Israel|one Jehovah|love Jehovah thy God'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Luke.2" -H "$AUTH" | grep -qE '样例|凯撒|救主'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Luke.2" -H "$AUTH" | grep -qE '見本|アウグスト|救主'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Deut.6" -H "$AUTH" | grep -qE '样例|以色列|独一的主'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Deut.6" -H "$AUTH" | grep -qE '見本|イスラエル|唯一の主'
echo "MULTI_BOOK_NARRATIVE_OK"

# Multi-book teaching dual-pane scaffolds (Matt.6 / Gal.5) — short license-safe samples
put_chapter "bible/web/Matt.6.json" '{"book":"Matt","chapter":6,"verses":[{"verse":9,"text":"Pray like this: \"Our Father in heaven, may your name be kept holy."},{"verse":10,"text":"Let your Kingdom come. Let your will be done on earth as it is in heaven."},{"verse":11,"text":"Give us today our daily bread."},{"verse":33,"text":"But seek first God'\''s Kingdom and his righteousness; and all these things will be given to you as well."}]}'
put_chapter "bible/kjv/Matt.6.json" '{"book":"Matt","chapter":6,"verses":[{"verse":9,"text":"After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name."},{"verse":10,"text":"Thy kingdom come. Thy will be done in earth, as it is in heaven."},{"verse":11,"text":"Give us this day our daily bread."},{"verse":33,"text":"But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."}]}'
put_chapter "bible/asv/Matt.6.json" '{"book":"Matt","chapter":6,"verses":[{"verse":9,"text":"After this manner therefore pray ye: Our Father who art in heaven, Hallowed be thy name."},{"verse":10,"text":"Thy kingdom come. Thy will be done, as in heaven, so on earth."},{"verse":11,"text":"Give us this day our daily bread."},{"verse":33,"text":"But seek ye first his kingdom, and his righteousness; and all these things shall be added unto you."}]}'
put_chapter "bible/cuvs/Matt.6.json" '{"book":"Matt","chapter":6,"verses":[{"verse":9,"text":"（样例）所以，你们祷告要这样说：我们在天上的父：愿人都尊你的名为圣。"},{"verse":10,"text":"（样例）愿你的国降临；愿你的旨意行在地上，如同行在天上。"},{"verse":11,"text":"（样例）我们日用的饮食，今日赐给我们。"},{"verse":33,"text":"（样例）你们要先求他的国和他的义，这些东西都要加给你们了。"}]}'
put_chapter "bible/kougo/Matt.6.json" '{"book":"Matt","chapter":6,"verses":[{"verse":9,"text":"（見本）だから、あなたがたはこう祈りなさい、『天にいますわれらの父よ。御名があがめられますように。"},{"verse":10,"text":"（見本）御国がきますように。みこころが天に行われるとおり、地にも行われますように。"},{"verse":11,"text":"（見本）わたしたちの日ごとの食物を、今日もお与えください。"},{"verse":33,"text":"（見本）まず神の国と神の義とを求めなさい。そうすれば、これらのものは、すべて添えて与えられるであろう。"}]}'
put_chapter "bible/web/Gal.5.json" '{"book":"Gal","chapter":5,"verses":[{"verse":16,"text":"But I say, walk by the Spirit, and you won'\''t fulfill the lust of the flesh."},{"verse":22,"text":"But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith,"},{"verse":23,"text":"gentleness, and self-control. Against such things there is no law."},{"verse":25,"text":"If we live by the Spirit, let'\''s also walk by the Spirit."}]}'
put_chapter "bible/kjv/Gal.5.json" '{"book":"Gal","chapter":5,"verses":[{"verse":16,"text":"This I say then, Walk in the Spirit, and ye shall not fulfil the lust of the flesh."},{"verse":22,"text":"But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,"},{"verse":23,"text":"Meekness, temperance: against such there is no law."},{"verse":25,"text":"If we live in the Spirit, let us also walk in the Spirit."}]}'
put_chapter "bible/asv/Gal.5.json" '{"book":"Gal","chapter":5,"verses":[{"verse":16,"text":"But I say, Walk by the Spirit, and ye shall not fulfil the lust of the flesh."},{"verse":22,"text":"But the fruit of the Spirit is love, joy, peace, longsuffering, kindness, goodness, faithfulness,"},{"verse":23,"text":"meekness, self-control; against such there is no law."},{"verse":25,"text":"If we live by the Spirit, by the Spirit let us also walk."}]}'
put_chapter "bible/cuvs/Gal.5.json" '{"book":"Gal","chapter":5,"verses":[{"verse":16,"text":"（样例）我说，你们当顺着圣灵而行，就不放纵肉体的情欲了。"},{"verse":22,"text":"（样例）圣灵所结的果子，就是仁爱、喜乐、和平、忍耐、恩慈、良善、信实、"},{"verse":23,"text":"（样例）温柔、节制。这样的事没有律法禁止。"},{"verse":25,"text":"（样例）我们若是靠圣灵得生，就当靠圣灵行事。"}]}'
put_chapter "bible/kougo/Gal.5.json" '{"book":"Gal","chapter":5,"verses":[{"verse":16,"text":"（見本）わたしは命じる。御霊によって歩きなさい。そうすれば、決して肉の欲を満たすことはない。"},{"verse":22,"text":"（見本）御霊の実は、愛、喜び、平和、寛容、慈愛、善意、忠実、"},{"verse":23,"text":"（見本）柔和、自制である。これらを禁ずる律法はない。"},{"verse":25,"text":"（見本）もしわたしたちが御霊によって生きるのなら、また御霊によって進もうではないか。"}]}'

echo "Multi-book teaching scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.6" -H "$AUTH" | grep -qiE 'Our Father|daily bread|seek first'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.6" -H "$AUTH" | grep -qiE 'Our Father|daily bread|kingdom of God'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.6" -H "$AUTH" | grep -qiE 'Our Father|daily bread|his kingdom'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Gal.5" -H "$AUTH" | grep -qiE 'fruit of the Spirit|love, joy, peace|walk by the Spirit'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Gal.5" -H "$AUTH" | grep -qiE 'fruit of the Spirit|Walk in the Spirit|longsuffering'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Gal.5" -H "$AUTH" | grep -qiE 'fruit of the Spirit|Walk by the Spirit|self-control'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Matt.6" -H "$AUTH" | grep -qE '样例|天上的父|先求他的国'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Matt.6" -H "$AUTH" | grep -qE '見本|われらの父|神の国'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Gal.5" -H "$AUTH" | grep -qE '样例|圣灵所结的果子|仁爱'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Gal.5" -H "$AUTH" | grep -qE '見本|御霊の実|愛、喜び'
echo "MULTI_BOOK_TEACHING_OK"

# Multi-book pastoral dual-pane scaffolds (Phil.4 / 1Cor.13) — short license-safe samples
put_chapter "bible/web/Phil.4.json" '{"book":"Phil","chapter":4,"verses":[{"verse":4,"text":"Rejoice in the Lord always! Again I will say, Rejoice!"},{"verse":6,"text":"In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God."},{"verse":7,"text":"And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus."},{"verse":13,"text":"I can do all things through Christ who strengthens me."}]}'
put_chapter "bible/kjv/Phil.4.json" '{"book":"Phil","chapter":4,"verses":[{"verse":4,"text":"Rejoice in the Lord alway: and again I say, Rejoice."},{"verse":6,"text":"Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."},{"verse":7,"text":"And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."},{"verse":13,"text":"I can do all things through Christ which strengtheneth me."}]}'
put_chapter "bible/asv/Phil.4.json" '{"book":"Phil","chapter":4,"verses":[{"verse":4,"text":"Rejoice in the Lord always: again I will say, Rejoice."},{"verse":6,"text":"In nothing be anxious; but in everything by prayer and supplication with thanksgiving let your requests be made known unto God."},{"verse":7,"text":"And the peace of God, which passeth all understanding, shall guard your hearts and your thoughts in Christ Jesus."},{"verse":13,"text":"I can do all things in him that strengtheneth me."}]}'
put_chapter "bible/cuvs/Phil.4.json" '{"book":"Phil","chapter":4,"verses":[{"verse":4,"text":"（样例）你们要靠主常常喜乐。我再说，你们要喜乐。"},{"verse":6,"text":"（样例）应当一无挂虑，只要凡事藉着祷告、祈求，和感谢，将你们所要的告诉神。"},{"verse":7,"text":"（样例）神所赐、出人意外的平安必在基督耶稣里保守你们的心怀意念。"},{"verse":13,"text":"（样例）我靠着那加给我力量的，凡事都能做。"}]}'
put_chapter "bible/kougo/Phil.4.json" '{"book":"Phil","chapter":4,"verses":[{"verse":4,"text":"（見本）主にあって常に喜びなさい。繰り返して言う、喜びなさい。"},{"verse":6,"text":"（見本）何事も思い煩ってはならない。ただ、萬事を感謝をもって祈りと願いとにし、あなたがたの求めるところを神に申しあげなさい。"},{"verse":7,"text":"（見本）そうすれば、人知を超えた神の平安が、あなたがたの心と思いとをキリスト・イエスにあって守るであろう。"},{"verse":13,"text":"（見本）わたしを強くしてくださるかたによって、何事でもすることができる。"}]}'
put_chapter "bible/web/1Cor.13.json" '{"book":"1Cor","chapter":13,"verses":[{"verse":1,"text":"If I speak with the languages of men and of angels, but don'\''t have love, I have become sounding brass, or a clanging cymbal."},{"verse":4,"text":"Love is patient and is kind. Love doesn'\''t envy. Love doesn'\''t brag, is not proud,"},{"verse":7,"text":"bears all things, believes all things, hopes all things, and endures all things."},{"verse":13,"text":"But now faith, hope, and love remain—these three. The greatest of these is love."}]}'
put_chapter "bible/kjv/1Cor.13.json" '{"book":"1Cor","chapter":13,"verses":[{"verse":1,"text":"Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal."},{"verse":4,"text":"Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,"},{"verse":7,"text":"Beareth all things, believeth all things, hopeth all things, endureth all things."},{"verse":13,"text":"And now abideth faith, hope, charity, these three; but the greatest of these is charity."}]}'
put_chapter "bible/asv/1Cor.13.json" '{"book":"1Cor","chapter":13,"verses":[{"verse":1,"text":"If I speak with the tongues of men and of angels, but have not love, I am become sounding brass, or a clanging cymbal."},{"verse":4,"text":"Love suffereth long, and is kind; love envieth not; love vaunteth not itself, is not puffed up,"},{"verse":7,"text":"beareth all things, believeth all things, hopeth all things, endureth all things."},{"verse":13,"text":"But now abideth faith, hope, love, these three; and the greatest of these is love."}]}'
put_chapter "bible/cuvs/1Cor.13.json" '{"book":"1Cor","chapter":13,"verses":[{"verse":1,"text":"（样例）我若能说万人的方言，并天使的话语，却没有爱，我就成了鸣的锣、响的钹一般。"},{"verse":4,"text":"（样例）爱是恒久忍耐，又有恩慈；爱是不嫉妒；爱是不自夸，不张狂，"},{"verse":7,"text":"（样例）凡事包容，凡事相信，凡事盼望，凡事忍耐。"},{"verse":13,"text":"（样例）如今常存的有信，有望，有爱这三样，其中最大的是爱。"}]}'
put_chapter "bible/kougo/1Cor.13.json" '{"book":"1Cor","chapter":13,"verses":[{"verse":1,"text":"（見本）たといわたしが、人々の異言や、天使たちの言葉を語っても、もし愛がなければ、わたしは、やかましい鐘や騒がしい鐃鉢と同じである。"},{"verse":4,"text":"（見本）愛は寛容であり、慈愛がある。また嫉妬しない。愛は自慢せず、高ぶらない、"},{"verse":7,"text":"（見本）そして、すべてを忍び、すべてを信じ、すべてを望み、すべてを耐える。"},{"verse":13,"text":"（見本）このように、いつまでも存続するものは、信仰と希望と愛と、これら三つである。その中で最も大いなるものは、愛である。"}]}'

echo "Multi-book pastoral scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Phil.4" -H "$AUTH" | grep -qiE 'Rejoice in the Lord|peace of God|all things through Christ'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Phil.4" -H "$AUTH" | grep -qiE 'Rejoice in the Lord|peace of God|all things through Christ'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Phil.4" -H "$AUTH" | grep -qiE 'Rejoice in the Lord|peace of God|all things in him'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=1Cor.13" -H "$AUTH" | grep -qiE 'don.t have love|Love is patient|greatest of these is love'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=1Cor.13" -H "$AUTH" | grep -qiE 'have not charity|Charity suffereth|greatest of these is charity'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=1Cor.13" -H "$AUTH" | grep -qiE 'have not love|Love suffereth|greatest of these is love'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Phil.4" -H "$AUTH" | grep -qE '样例|常常喜乐|凡事都能做'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Phil.4" -H "$AUTH" | grep -qE '見本|常に喜び|何事でもできる'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=1Cor.13" -H "$AUTH" | grep -qE '样例|恒久忍耐|最大的是爱'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=1Cor.13" -H "$AUTH" | grep -qE '見本|愛は寛容|最も大いなるものは、愛'
echo "MULTI_BOOK_PASTORAL_OK"

put_chapter "bible/web/John.15.json" '{"book":"John","chapter":15,"verses":[{"verse":1,"text":"\"I am the true vine, and my Father is the farmer."},{"verse":5,"text":"I am the vine. You are the branches. He who remains in me and I in him bears much fruit, for apart from me you can do nothing."},{"verse":9,"text":"Even as the Father has loved me, I also have loved you. Remain in my love."},{"verse":12,"text":"This is my commandment, that you love one another, even as I have loved you."}]}'
put_chapter "bible/kjv/John.15.json" '{"book":"John","chapter":15,"verses":[{"verse":1,"text":"I am the true vine, and my Father is the husbandman."},{"verse":5,"text":"I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing."},{"verse":9,"text":"As the Father hath loved me, so have I loved you: continue ye in my love."},{"verse":12,"text":"This is my commandment, That ye love one another, as I have loved you."}]}'
put_chapter "bible/asv/John.15.json" '{"book":"John","chapter":15,"verses":[{"verse":1,"text":"I am the true vine, and my Father is the husbandman."},{"verse":5,"text":"I am the vine, ye are the branches: He that abideth in me, and I in him, the same beareth much fruit: for apart from me ye can do nothing."},{"verse":9,"text":"Even as the Father hath loved me, I also have loved you: abide ye in my love."},{"verse":12,"text":"This is my commandment, that ye love one another, even as I have loved you."}]}'
put_chapter "bible/cuvs/John.15.json" '{"book":"John","chapter":15,"verses":[{"verse":1,"text":"（样例）我是真葡萄树，我父是栽培的人。"},{"verse":5,"text":"（样例）我是葡萄树，你们是枝子。常在我里面的，我也常在他里面，这人就多结果子；因为离了我，你们就不能做什么。"},{"verse":9,"text":"（样例）我爱你们，正如父爱我一样；你们要常在我的爱里。"},{"verse":12,"text":"（样例）你们要彼此相爱，像我爱你们一样；这就是我的命令。"}]}'
put_chapter "bible/kougo/John.15.json" '{"book":"John","chapter":15,"verses":[{"verse":1,"text":"（見本）わたしはまことのぶどうの木、わたしの父は栽培者である。"},{"verse":5,"text":"（見本）わたしはぶどうの木、あなたがたは枝である。人がわたしにつながっており、わたしもその人につながっておれば、その人は豊かに実を結ぶようになる。わたしから離れては、あなたがたは何もできないからである。"},{"verse":9,"text":"（見本）父がわたしを愛されたように、わたしもあなたがたを愛したのである。わたしの愛のうちにとどまっていなさい。"},{"verse":12,"text":"（見本）わたしがあなたがたを愛したように、あなたがたも互に愛し合うこと、これがわたしのいましめである。"}]}'
put_chapter "bible/web/Rev.21.json" '{"book":"Rev","chapter":21,"verses":[{"verse":1,"text":"I saw a new heaven and a new earth, for the first heaven and the first earth have passed away, and the sea is no more."},{"verse":3,"text":"I heard a loud voice out of heaven saying, \"Behold, God'\''s dwelling is with people; and he will dwell with them, and they will be his people, and God himself will be with them as their God."},{"verse":4,"text":"He will wipe away every tear from their eyes. Death will be no more; neither will there be mourning, nor crying, nor pain any more. The first things have passed away.\""},{"verse":5,"text":"He who sits on the throne said, \"Behold, I am making all things new.\" He said, \"Write, for these words of God are faithful and true.\""}]}'
put_chapter "bible/kjv/Rev.21.json" '{"book":"Rev","chapter":21,"verses":[{"verse":1,"text":"And I saw a new heaven and a new earth: for the first heaven and the first earth were passed away; and there was no more sea."},{"verse":3,"text":"And I heard a great voice out of heaven saying, Behold, the tabernacle of God is with men, and he will dwell with them, and they shall be his people, and God himself shall be with them, and be their God."},{"verse":4,"text":"And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away."},{"verse":5,"text":"And he that sat upon the throne said, Behold, I make all things new. And he said unto me, Write: for these words are true and faithful."}]}'
put_chapter "bible/asv/Rev.21.json" '{"book":"Rev","chapter":21,"verses":[{"verse":1,"text":"And I saw a new heaven and a new earth: for the first heaven and the first earth are passed away; and the sea is no more."},{"verse":3,"text":"And I heard a great voice out of the throne saying, Behold, the tabernacle of God is with men, and he shall dwell with them, and they shall be his peoples, and God himself shall be with them, and be their God:"},{"verse":4,"text":"and he shall wipe away every tear from their eyes; and death shall be no more; neither shall there be mourning, nor crying, nor pain, any more: the first things are passed away."},{"verse":5,"text":"And he that sitteth on the throne said, Behold, I make all things new. And he saith, Write: for these words are faithful and true."}]}'
put_chapter "bible/cuvs/Rev.21.json" '{"book":"Rev","chapter":21,"verses":[{"verse":1,"text":"（样例）我又看见一个新天新地；因为先前的天地已经过去了，海也不再有了。"},{"verse":3,"text":"（样例）我听见有大声音从宝座出来说：看哪，神的帐幕在人间。他要与人同住，他们要作他的子民。神要亲自与他们同在，作他们的神。"},{"verse":4,"text":"（样例）神要擦去他们一切的眼泪；不再有死亡，也不再有悲哀、哭号、疼痛，因为以前的事都过去了。"},{"verse":5,"text":"（样例）坐宝座的说：看哪，我将一切都更新了！又说：你要写上；因这些话是可信的，是真实的。"}]}'
put_chapter "bible/kougo/Rev.21.json" '{"book":"Rev","chapter":21,"verses":[{"verse":1,"text":"（見本）わたしはまた、新しい天と新しい地とを見た。先の天と地とは消え去り、海もなくなってしまった。"},{"verse":3,"text":"（見本）また、大きな声が御座から出てきて言った、「見よ、神の幕屋が人と共にあり、神が人と共に住み、人は神の民となり、神自ら人と共に在して、"},{"verse":4,"text":"（見本）人の目から涙を全くぬぐいとって下さる。もはや、死もなく、悲しみも、叫びも、痛みもない。先のものが、すでに過ぎ去ったからである」。"},{"verse":5,"text":"（見本）すると、御座にいますかたが言われた、「見よ、わたしは万物を新しくする」。また言われた、「書きしるせ。これらの言葉は信頼すべきであり、まことである」。"}]}'

echo "Multi-book apocalyptic scaffolds:"
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.15" -H "$AUTH" | grep -qiE 'true vine|branches|Remain in my love'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Rev.21" -H "$AUTH" | grep -qiE 'new heaven and a new earth|wipe away every tear'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.15" -H "$AUTH" | grep -qE '样例|真葡萄树'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Rev.21" -H "$AUTH" | grep -qE '見本|新しい天と新しい地'
echo "MULTI_BOOK_APOCALYPTIC_OK"

# JSON-fixture key chapters (no TypeScript densify packs)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Building bible package for JSON-fixture R2 seed…"
(cd "$ROOT" && pnpm --filter @logoshome/bible build >/dev/null)
echo "Seeding key chapters from fixtures/corpus JSON…"
node "$ROOT/scripts/seed-r2-from-json-fixtures.mjs" "$BASE" "$TOKEN"
# Fixtures cover WEB teaching set + peer samples; assert what exists after seed.
for tid in web; do
  for ref in John.1 John.3 John.14 Ps.23 Rom.8 Matt.5 Gen.1; do
    body=$(curl -sf "$BASE/v1/bible/chapter?translation=$tid&ref=$ref" -H "$AUTH")
    echo "$body" | grep -q '"source":"r2"'
    echo "KEY_CHAPTER_R2_OK tid=$tid ref=$ref"
  done
done
# Short samples put above for licensed tids
for tid in cuvs kougo shinKyoudou; do
  for ref in John.1 John.3; do
    body=$(curl -sf "$BASE/v1/bible/chapter?translation=$tid&ref=$ref" -H "$AUTH")
    echo "$body" | grep -q '"source":"r2"'
    echo "KEY_CHAPTER_R2_OK tid=$tid ref=$ref"
  done
done
echo "KEY_CHAPTER_R2_SEED_OK"
echo SEED_R2_OK
