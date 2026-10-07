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
echo SEED_R2_OK
