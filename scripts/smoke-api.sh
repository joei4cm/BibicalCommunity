#!/usr/bin/env bash
# Local API smoke against wrangler dev (default http://127.0.0.1:8787)
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
echo "== health =="
curl -sf "$BASE/health" | head -c 200; echo
HANDLE="smoke$(date +%s)"
PASS='SmokeTestPass123!'
echo "== register (locale=zh short tag) =="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"Smoke\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
LOCALE=$(echo "$REG" | sed -n 's/.*"locale":"\([^"]*\)".*/\1/p')
echo "token=${TOKEN:0:12}… locale=$LOCALE"
test "$LOCALE" = "zh-CN"
AUTH="Authorization: Bearer $TOKEN"
echo "== bible translations =="
curl -sf "$BASE/v1/bible/translations" | head -c 120; echo
echo "== chapter WEB John.1 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.1" | head -c 160; echo
echo "== chapter WEB John.2 =="
J2=$(curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.2")
echo "$J2" | head -c 160; echo
echo "$J2" | grep -q 'wedding in Cana'
echo "== chapter mainstream John.2 scaffolds =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.2" | grep -qE '迦拿|娶亲'
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.2" | grep -qE '迦拿|娶親'
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.2" | grep -qE '迦拿|娶亲'
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.2" | grep -qE '迦拿|婚宴'
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.2" | grep -qE '迦拿|婚筵'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=John.2" | grep -qi 'Cana'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.2" | grep -qi 'Cana'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=kougoyaku-pd&ref=John.2" | grep -qE 'カナ|婚筵'
echo "JOHN2_MULTILANG_OK"
echo "== chapter ASV John.3 =="
A3=$(curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.3")
echo "$A3" | head -c 160; echo
echo "$A3" | grep -q 'God so loved the world'
echo "== chapter mainstream John.3 scaffolds (zh/ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.3" | grep -qE '神爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.3" | grep -qE '神愛世人|獨生子'
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.3" | grep -qE '神爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.3" | grep -qE '上帝深爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.3" | grep -qE '上帝这样地爱了世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.3" | grep -qE 'ニコデモ|ひとり子'
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.3" | grep -qE 'ニコデモ|ひとり子'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.3" | grep -qE 'ニコデモ|独り子'
curl -sf "$BASE/v1/bible/chapter?translation=kougoyaku-pd&ref=John.3" | grep -qE 'ニコデモ|獨り子'
echo "JOHN3_ZHJA_OK"
echo "== multi-book scaffolds Gen.1 / Matt.5 / Ps.23 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.5" | grep -qiE 'poor in spirit|Blessed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.5" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.5" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Gen.1" | grep -qE '样例|起初|创造'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Gen.1" | grep -qE '見本|創造|はじめに'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.23" | grep -qE '样例|牧者'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.23" | grep -qE '見本|牧者'
echo "MULTI_BOOK_SCAFFOLD_OK"
echo "== multi-book NT scaffolds Rom.8 / Heb.11 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Rom.8" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Rom.8" | grep -qiE 'no condemnation|If God be for us'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Rom.8" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Heb.11" | grep -qiE 'faith is assurance|hoped for'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Heb.11" | grep -qiE 'substance of things hoped for|impossible to please'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Heb.11" | grep -qiE 'assurance of things hoped for|conviction'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Rom.8" | grep -qE '样例|不定罪'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Rom.8" | grep -qE '見本|罪に定められることがない'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Heb.11" | grep -qE '样例|信就是|实底'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Heb.11" | grep -qE '見本|信仰とは'
echo "MULTI_BOOK_NT_OK"
echo "== multi-book OT/NT scaffolds Isa.53 / Acts.2 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Isa.53" | grep -qiE 'believed our message|pierced for our transgressions|wounds we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Isa.53" | grep -qiE 'believed our report|wounded for our transgressions|stripes we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Isa.53" | grep -qiE 'believed our message|wounded for our transgressions|sheep have gone astray'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Acts.2" | grep -qiE 'Pentecost|Holy Spirit'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Acts.2" | grep -qiE 'Pentecost|Holy Ghost|Repent'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Acts.2" | grep -qiE 'Pentecost|Holy Spirit|mighty wind'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Isa.53" | grep -qE '样例|我们所传的|鞭伤'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Isa.53" | grep -qE '見本|信じ得たか|主の腕'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Acts.2" | grep -qE '样例|五旬节'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Acts.2" | grep -qE '見本|五旬節'
echo "MULTI_BOOK_OTNT_OK"
echo "== multi-book wisdom scaffolds Ps.1 / Prov.3 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the ungodly'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Prov.3" | grep -qiE 'Trust in Yahweh|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Prov.3" | grep -qiE 'Trust in the LORD|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Prov.3" | grep -qiE 'Trust in Jehovah|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.1" | grep -qE '样例|恶人的计谋|有福'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.1" | grep -qE '見本|悪しき者|さいわい'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Prov.3" | grep -qE '样例|仰赖耶和华|自己的聪明'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Prov.3" | grep -qE '見本|主に信頼|自分の知識'
echo "MULTI_BOOK_WISDOM_OK"
echo "== multi-book law/gospel scaffolds Mark.1 / Exod.20 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Mark.1" | grep -qiE 'beginning of the Good News|Jesus Christ|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Mark.1" | grep -qiE 'beginning of the gospel|Son of God|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Mark.1" | grep -qiE 'beginning of the gospel|Make ye ready|baptism of repentance'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Exod.20" | grep -qiE 'Yahweh your God|no other gods|Honor your father'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Exod.20" | grep -qiE 'LORD thy God|no other gods|Honour thy father'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Exod.20" | grep -qiE 'Jehovah thy God|no other gods|Honor thy father'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Mark.1" | grep -qE '样例|耶稣基督|福音的起头'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Mark.1" | grep -qE '見本|イエス・キリスト|福音のはじめ'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Exod.20" | grep -qE '样例|耶和华你的神|不可有别的神'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Exod.20" | grep -qE '見本|エジプトの地|神としてはならない'
echo "MULTI_BOOK_LAW_GOSPEL_OK"
echo "== multi-book narrative scaffolds Luke.2 / Deut.6 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Luke.2" | grep -qiE 'Caesar Augustus|good news of great joy|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Luke.2" | grep -qiE 'Caesar Augustus|manger|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Luke.2" | grep -qiE 'Caesar Augustus|good tidings|Christ the Lord'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Deut.6" | grep -qiE 'Hear, Israel|Yahweh is one|love Yahweh your God'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Deut.6" | grep -qiE 'Hear, O Israel|one LORD|love the LORD thy God'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Deut.6" | grep -qiE 'Hear, O Israel|one Jehovah|love Jehovah thy God'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Luke.2" | grep -qE '样例|凯撒|救主'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Luke.2" | grep -qE '見本|アウグスト|救主'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Deut.6" | grep -qE '样例|以色列|独一的主'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Deut.6" | grep -qE '見本|イスラエル|唯一の主'
echo "MULTI_BOOK_NARRATIVE_OK"
echo "== multi-book teaching scaffolds Matt.6 / Gal.5 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.6" | grep -qiE 'Our Father|daily bread|seek first'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.6" | grep -qiE 'Our Father|daily bread|kingdom of God'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.6" | grep -qiE 'Our Father|daily bread|his kingdom'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Gal.5" | grep -qiE 'fruit of the Spirit|love, joy, peace|walk by the Spirit'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Gal.5" | grep -qiE 'fruit of the Spirit|Walk in the Spirit|longsuffering'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Gal.5" | grep -qiE 'fruit of the Spirit|Walk by the Spirit|self-control'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Matt.6" | grep -qE '样例|天上的父|先求他的国'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Matt.6" | grep -qE '見本|われらの父|神の国'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Gal.5" | grep -qE '样例|圣灵所结的果子|仁爱'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Gal.5" | grep -qE '見本|御霊の実|愛、喜び'
echo "MULTI_BOOK_TEACHING_OK"
echo "== multi-book pastoral scaffolds Phil.4 / 1Cor.13 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Phil.4" | grep -qiE 'Rejoice in the Lord|peace of God|all things through Christ'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Phil.4" | grep -qiE 'Rejoice in the Lord|peace of God|all things through Christ'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Phil.4" | grep -qiE 'Rejoice in the Lord|peace of God|all things in him'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=1Cor.13" | grep -qiE 'don.t have love|Love is patient|greatest of these is love'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=1Cor.13" | grep -qiE 'have not charity|Charity suffereth|greatest of these is charity'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=1Cor.13" | grep -qiE 'have not love|Love suffereth|greatest of these is love'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Phil.4" | grep -qE '样例|常常喜乐|凡事都能做'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Phil.4" | grep -qE '見本|常に喜び|何事でもできる'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=1Cor.13" | grep -qE '样例|恒久忍耐|最大的是爱'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=1Cor.13" | grep -qE '見本|愛は寛容|最も大いなるものは、愛'
echo "MULTI_BOOK_PASTORAL_OK"
echo "== multi-book apocalyptic scaffolds John.15 / Rev.21 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.15" | grep -qiE 'true vine|branches|Remain in my love|love one another'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=John.15" | grep -qiE 'true vine|abideth in me|love one another'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.15" | grep -qiE 'true vine|abideth in me|love one another'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Rev.21" | grep -qiE 'new heaven and a new earth|wipe away every tear|making all things new'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Rev.21" | grep -qiE 'new heaven and a new earth|wipe away all tears|make all things new'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Rev.21" | grep -qiE 'new heaven and a new earth|wipe away every tear|make all things new'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.15" | grep -qE '样例|真葡萄树|彼此相爱'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.15" | grep -qE '見本|まことのぶどう|互に愛し合う'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Rev.21" | grep -qE '样例|新天新地|擦去他们一切的眼泪'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Rev.21" | grep -qE '見本|新しい天と新しい地|涙を全くぬぐい'
echo "MULTI_BOOK_APOCALYPTIC_OK"
echo "== multi-book wisdom-NT scaffolds Jas.1 / Col.3 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Jas.1" | grep -qiE 'Count it all joy|ask of God|doers of the word'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Jas.1" | grep -qiE 'count it all joy|ask of God|doers of the word'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Jas.1" | grep -qiE 'Count it all joy|ask of God|doers of the word'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Col.3" | grep -qiE 'things that are above|walk in love|word of Christ dwell'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Col.3" | grep -qiE 'things which are above|put on charity|word of Christ dwell'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Col.3" | grep -qiE 'things that are above|put on love|word of Christ dwell'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Jas.1" | grep -qE '样例|大喜乐|行道'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Jas.1" | grep -qE '見本|喜ばしい|実行する人'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Col.3" | grep -qE '样例|上面的事|联络全德'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Col.3" | grep -qE '見本|上にあるもの|愛を加え'
echo "MULTI_BOOK_WISDOM_NT_OK"
echo "== multi-book commission/grace scaffolds Matt.28 / Eph.2 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.28" | grep -qiE 'All authority|make disciples|end of the age'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.28" | grep -qiE 'All power|teach all nations|end of the world'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.28" | grep -qiE 'All authority|make disciples|end of the world'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Eph.2" | grep -qiE 'by grace you have been saved|gift of God|good works'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Eph.2" | grep -qiE 'by grace are ye saved|gift of God|good works'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Eph.2" | grep -qiE 'by grace have ye been saved|gift of God|good works'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Matt.28" | grep -qE '样例|万民|同在'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Matt.28" | grep -qE '見本|弟子|共にいる'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Eph.2" | grep -qE '样例|本乎恩|行善'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Eph.2" | grep -qE '見本|恵みにより|良い行い'
echo "MULTI_BOOK_COMMISSION_GRACE_OK"
echo "== chapter CUVS John.1 (zh) =="

CUVS=$(curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1")
echo "$CUVS" | head -c 160; echo
echo "$CUVS" | grep -q '太初有道'
echo "== chapter CUVT John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.1" | grep -q '太初有道'
echo "== chapter kougo John.1 (ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.1" | grep -q '初めに言があった'
echo "== chapter RCUV John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.1" | grep -q '太初有道'
echo "== chapter shinkaiyaku John.1 (ja) =="
# Local scaffold or R2 sample seed both include 初めに…
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.1" | grep -qE '初めに(ことば|言)が'
echo "== chapter shinKyoudou John.1 (ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.1" | grep -q '初めに言があった'
echo "== chapter CCB John.1 (zh) =="
# Local scaffold (太初有道) or R2 sample seed (宇宙被造以前…)
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.1" | grep -qE '太初有道|宇宙被造以前|道已经存在|道就是'
echo "== chapter LZZ John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.1" | grep -qE '起初有道|太初有道|道与'
echo "== partner endao chapter sso flag =="
ENDAO_CH=$(curl -sf "$BASE/v1/bible/chapter?translation=endao&ref=John.1")
echo "$ENDAO_CH" | head -c 200; echo
echo "$ENDAO_CH" | grep -q '"sso":true'
echo "$ENDAO_CH" | grep -q 'sso=1'
echo "ENDAO_SSO_CHAPTER_OK"
echo "== chapter NIV external =="
curl -sf "$BASE/v1/bible/chapter?translation=niv&ref=John.1" | head -c 200; echo
echo "== partner mock authorize =="
curl -sf -o /dev/null -w "%{http_code}\n" "$BASE/v1/partners/mock-authorize?partner=endao&ref=John.1&redirect_uri=/v1/partners/endao/callback"
echo "== me =="
curl -sf -H "$AUTH" "$BASE/v1/me" | head -c 160; echo
echo "== plans create (non-CSV) =="
PLAN=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"晨祷计划","description":"smoke","visibility":"private","days":[{"day":1,"ref":"John.1","title":"Begin"},{"day":2,"ref":"John.2","title":"Wedding"}]}' \
  "$BASE/v1/plans")
echo "$PLAN" | head -c 120; echo
echo "$PLAN" | grep -q '"id":"plan_'
echo "PLAN_CREATE_OK"
PLAN_ID=$(echo "$PLAN" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "== plans CSV import + subscribe + progress =="
CSV_BODY=$'day,ref,title,note\n1,John.1,Word,Begin\n2,Gen.1,Create,Dawn\n3,Ps.23,Shepherd,Rest'
CSV_IMP=$(curl -sf -X POST -H "$AUTH" \
  -F "title=CSV灵修计划" \
  -F "csv=$CSV_BODY" \
  "$BASE/v1/plans/import-csv")
echo "$CSV_IMP" | head -c 160; echo
echo "$CSV_IMP" | grep -q '"id":"plan_'
CSV_ID=$(echo "$CSV_IMP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CSV_ID"
# Make plan public then subscribe as second user
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"公开晨更","description":"public smoke","visibility":"public","days":[{"day":1,"ref":"John.1","title":"Start"}]}' \
  "$BASE/v1/plans" >/dev/null
H_SUB="plansub$(date +%s)"
REG_SUB=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H_SUB\",\"password\":\"$PASS\",\"nickname\":\"Sub\",\"locale\":\"zh\"}")
TOKEN_SUB=$(echo "$REG_SUB" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
PUB=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/public")
echo "$PUB" | grep -q '"visibility":"public"'
PUB_ID=$(echo "$PUB" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);const p=(j.plans||[]).find(x=>x.title&&x.title.includes("公开"));if(!p)throw new Error("no public plan");process.stdout.write(p.id)})')
SUB=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/plans/$PUB_ID/subscribe")
echo "$SUB" | head -c 160; echo
echo "$SUB" | grep -q '"id":"psub_'
PROG=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"day":1}' "$BASE/v1/plans/$PUB_ID/progress")
echo "$PROG" | grep -q '"ok":true'
echo "$PROG" | grep -q '"progressDay":1'
echo "PLAN_CSV_SUBSCRIBE_OK"
echo "== plans devotion step persist =="
DEVOTION=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"step":"read","materialId":"morning-examen"}' "$BASE/v1/plans/$PUB_ID/devotion")
echo "$DEVOTION" | head -c 200; echo
echo "$DEVOTION" | grep -q '"ok":true'
echo "$DEVOTION" | grep -q '"devotionStep":"read"'
echo "$DEVOTION" | grep -q '"devotionMaterialId":"morning-examen"'
SUBS_AFTER=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/subscriptions")
echo "$SUBS_AFTER" | grep -q '"devotionStep":"read"'
echo "$SUBS_AFTER" | grep -q '"devotionMaterialId":"morning-examen"'
# Advance to reflect and confirm persistence
DEVOTION2=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"step":"reflect"}' "$BASE/v1/plans/$PUB_ID/devotion")
echo "$DEVOTION2" | grep -q '"devotionStep":"reflect"'
# materialId omitted → previous material retained
echo "$DEVOTION2" | grep -q '"devotionMaterialId":"morning-examen"'
SUBS_REFLECT=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/subscriptions")
echo "$SUBS_REFLECT" | grep -q '"devotionStep":"reflect"'
echo "PLAN_DEVOTION_STEP_OK"
test -n "$PLAN_ID"
echo "== turn credentials =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/calls/turn-credentials" | head -c 200; echo
echo "== partners status =="
curl -sf "$BASE/v1/partners/status" | head -c 200; echo
echo "== partner SSO mock closed loop =="
SSO_STATUS=$(curl -sf "$BASE/v1/partners/status")
echo "$SSO_STATUS" | grep -q '"endao":{"ssoEnabled":true'
echo "$SSO_STATUS" | grep -q '"weread":{"ssoEnabled":true'
echo "SSO_STATUS_OK"
SSO_START=$(curl -sf "$BASE/v1/partners/endao/start?ref=John.1")
echo "$SSO_START" | head -c 240; echo
echo "$SSO_START" | grep -q 'mock-authorize'
echo "$SSO_START" | grep -q '"mockIdp":true'
echo "SSO_START_OK"
WEREAD_START=$(curl -sf "$BASE/v1/partners/weread/start?ref=John.1")
echo "$WEREAD_START" | head -c 240; echo
echo "$WEREAD_START" | grep -q 'mock-authorize'
echo "$WEREAD_START" | grep -q '"mockIdp":true'
echo "$WEREAD_START" | grep -q '"partner":"weread"'
echo "WEREAD_SSO_START_OK"
SSO_LOOP=$(curl -sfL "$BASE/v1/partners/endao/start?ref=John.1&redirect=1")
echo "$SSO_LOOP" | head -c 240; echo
echo "$SSO_LOOP" | grep -q '"ok":true'
echo "$SSO_LOOP" | grep -q '"mock":true'
echo "SSO_LOOP_OK"
WEREAD_LOOP=$(curl -sfL "$BASE/v1/partners/weread/start?ref=John.1&redirect=1")
echo "$WEREAD_LOOP" | head -c 240; echo
echo "$WEREAD_LOOP" | grep -q '"ok":true'
echo "$WEREAD_LOOP" | grep -q '"mock":true'
echo "$WEREAD_LOOP" | grep -q '"partner":"weread"'
echo "WEREAD_SSO_LOOP_OK"
echo "== disappearing message tombstone =="
H2="smokepeer$(date +%s)"
REG2=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H2\",\"password\":\"$PASS\",\"nickname\":\"Peer\",\"locale\":\"en\"}")
PEER=$(echo "$REG2" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
TOKEN2=$(echo "$REG2" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
CONVO=$(curl -sf -X POST "$BASE/v1/chat/conversations" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"kind\":\"dm\",\"memberIds\":[\"$PEER\"],\"disappearingTtlSec\":1}")
CID=$(echo "$CONVO" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
LIST=$(curl -sf "$BASE/v1/chat/conversations" -H "$AUTH")
echo "$LIST" | grep -q "peerUserIds"
echo "PEER_IDS_OK"
curl -sf -X POST "$BASE/v1/chat/conversations/$CID/messages" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"ratchetHeader":"dGVzdA==","ciphertext":"Y3Q=","contentType":"msg"}' >/dev/null
sleep 2
AFTER=$(curl -sf "$BASE/v1/chat/conversations/$CID/messages" -H "$AUTH")
echo "$AFTER" | grep -q '"messages":\[\]'
echo "TTL_TOMBSTONE_OK"
echo "== conversation archive toggle =="
curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":true}' "$BASE/v1/chat/conversations/$CID" | grep -q '"archived":true'
ARCH_LIST=$(curl -sf "$BASE/v1/chat/conversations" -H "$AUTH")
echo "$ARCH_LIST" | node -e '
const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
const id=process.argv[1];
const c=(j.conversations||[]).find((x)=>x.id===id);
if(!c||!c.membership||c.membership.archived!==true) throw new Error("expected archived");
console.log("ARCHIVE_OK");
' "$CID"
curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":false}' "$BASE/v1/chat/conversations/$CID" | grep -q '"archived":false'
echo "UNARCHIVE_OK"
echo "== call create + turn =="
CALL=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"conversationId\":\"$CID\"}" "$BASE/v1/chat/calls")
echo "$CALL" | head -c 200; echo
echo "$CALL" | grep -q "signalingPath"
echo "CALL_SIGNAL_OK"
echo "== call websocket joined =="
CALL_ID=$(echo "$CALL" | sed -n 's/.*"callId":"\([^"]*\)".*/\1/p')
test -n "$CALL_ID"
WS_HOST="${BASE#http://}"
WS_HOST="${WS_HOST#https://}"
WS_URL="ws://${WS_HOST}/v1/calls/${CALL_ID}/ws?token=${TOKEN}&conversationId=${CID}"
node --input-type=module -e '
const url = process.argv[1];
let ok = false;
const ws = new WebSocket(url);
const timer = setTimeout(() => { console.error("CALL_WS_TIMEOUT"); process.exit(1); }, 8000);
ws.addEventListener("message", (ev) => {
  let msg;
  try { msg = JSON.parse(String(ev.data)); } catch { return; }
  if (msg && msg.type === "joined") {
    ok = true;
    clearTimeout(timer);
    console.log("CALL_WS_OK");
    ws.close();
    process.exit(0);
  }
});
ws.addEventListener("error", () => {
  if (ok) return;
  clearTimeout(timer);
  console.error("CALL_WS_ERROR");
  process.exit(1);
});
ws.addEventListener("close", () => {
  if (ok) return;
  clearTimeout(timer);
  console.error("CALL_WS_CLOSED");
  process.exit(1);
});
' "$WS_URL"
echo "== call websocket offer fan-out =="
WS_URL2="ws://${WS_HOST}/v1/calls/${CALL_ID}/ws?token=${TOKEN2}&conversationId=${CID}"
node --input-type=module -e '
const urlA = process.argv[1];
const urlB = process.argv[2];
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error("timeout")), 8000);
    ws.addEventListener("open", () => {});
    ws.addEventListener("message", (ev) => {
      let msg; try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.type === "joined") { clearTimeout(t); resolve({ ws, msg }); }
    });
    ws.addEventListener("error", () => { clearTimeout(t); reject(new Error("ws error")); });
  });
}
const a = await connect(urlA);
const b = await connect(urlB);
const got = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("no offer")), 8000);
  b.ws.addEventListener("message", (ev) => {
    let msg; try { msg = JSON.parse(String(ev.data)); } catch { return; }
    if (msg.type === "offer") { clearTimeout(t); resolve(msg); }
  });
});
a.ws.send(JSON.stringify({ type: "offer", sdp: "v=0-smoke" }));
const offer = await got;
if (!offer.sdp) throw new Error("missing sdp");
console.log("CALL_WS_FANOUT_OK");
a.ws.close(); b.ws.close();
process.exit(0);
' "$WS_URL" "$WS_URL2"

echo "== peer key bundle list (empty until upload) =="
curl -sf -H "Authorization: Bearer $TOKEN2" "$BASE/v1/keys/$PEER" | head -c 160; echo

echo "== auth-then-P2P key distribution =="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/smoke-keys.sh" "$BASE"

echo "== church home paths =="
export TOKEN TOKEN2 PEER CID BASE
# Call/screen signaling runs below; skip duplicate when home is nested here.
SMOKE_SKIP_CALL_SIGNALING=1 bash "$SCRIPT_DIR/smoke-home.sh" "$BASE"

echo "== study materials + home externalMediaUrl =="
bash "$SCRIPT_DIR/smoke-study-embed.sh" "$BASE"

echo "== call + screen signaling fan-out =="
node "$SCRIPT_DIR/smoke-call-signaling.mjs" "$BASE"

echo "== annotations CRUD (highlight + bookmark + note) =="
bash "$SCRIPT_DIR/smoke-annotations.sh" "$BASE"

echo "== me profile / privacy / search =="
bash "$SCRIPT_DIR/smoke-me.sh" "$BASE"

echo "== admin console (users / homes / groups / remote wipe) =="
bash "$SCRIPT_DIR/smoke-admin.sh" "$BASE"

echo "SMOKE_OK"
