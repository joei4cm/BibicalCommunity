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
echo SEED_R2_OK
