# -*- coding: utf-8 -*-
"""T-PROFILE-01 (1/3) — o SKOPOS tou agrou ftanei apo ti forma sto tag.

SIMERA: sto createFieldDevice pernaei KARFOTA to "agnostic". I forma DEN rotaei
pote. Ara kathe agros — xenodoxeio, meteorologikos, kathari ardefsi — krinetai os
plires agronomikos kai vgazei pseftikes elleipseis.

ARXI ASFALEIAS: an i forma DEN steilei timi, DEN grafetai tipota kai o agros
vgainei akrivos opos simera. Kamia siopili allagi se o,ti idi douleuei.

To `field_type` DEN peirazetai: krataei idi simasia «set aisthitiron».
"""
import io

P = (u"C:/Users/Katharak/OneDrive - \u0395\u03a0\u0399\u039c\u0395\u039b\u0397\u03a4\u0397\u03a1\u0399\u039f "
     u"\u0397\u03a1\u0391\u039a\u039b\u0395\u0399\u039f\u03a5/\u0395\u03c0\u03b9\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 "
     u"\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\u03c2/MACC/analysis/createField.js")

# To arxeio einai CRLF sto antigrafo ergasias (core.autocrlf=true) kai LF sto repo.
# Douleuo se LF gia na taireiazoun oi ankyres, kai to GRAFO PISO me ti DIKI tou
# symvasi. Den allazo tin morfi enos arxeiou pou den mou zitithike na allakso.
_raw = io.open(P, encoding="utf-8", newline="").read()
assert not _raw.startswith(u"﻿"), "to arxeio exei BOM"
_WAS_CRLF = "\r\n" in _raw
s = _raw.replace("\r\n", "\n")
assert "\r" not in s, "vrethike skhetos CR — mikti symvasi, stamatao"


def sub(old, new, count=1):
    global s
    c = s.count(old)
    assert c == count, "anchor %d != %d: %r" % (c, count, old[:90])
    s = s.replace(old, new)


# ── 1. Anagnosi tis timis apo ti forma, dipla stis ypoloipes ────────────────
sub(
    u'  const coordinates = scope.find((i) => i.variable === "coordinates")?.value || "35.0, 25.0";\n',
    u'  const coordinates = scope.find((i) => i.variable === "coordinates")?.value || "35.0, 25.0";\n'
    u'\n'
    u'  /* \u2500\u2500 T-PROFILE-01 \u00b7 \u039f \u03a3\u039a\u039f\u03a0\u039f\u03a3 \u03a4\u039f\u03a5 \u0391\u0393\u03a1\u039f\u03a5 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    u'     \u039c\u03ad\u03c7\u03c1\u03b9 \u03c4\u03ce\u03c1\u03b1 \u03bf \u03c3\u03ba\u03bf\u03c0\u03cc\u03c2 \u0394\u0395\u039d \u03c1\u03c9\u03c4\u03b9\u03cc\u03c4\u03b1\u03bd \u03c0\u03bf\u03c5\u03b8\u03b5\u03bd\u03ac: \u03c0\u03b1\u03c1\u03b1\u03ba\u03ac\u03c4\u03c9 \u03c0\u03b5\u03c1\u03bd\u03bf\u03cd\u03c3\u03b5 \u03ba\u03b1\u03c1\u03c6\u03c9\u03c4\u03ac\n'
    u'     \u03c4\u03bf "agnostic". \u0388\u03c4\u03c3\u03b9 \u03ba\u03ac\u03b8\u03b5 \u03b1\u03b3\u03c1\u03cc\u03c2 \u2014 \u03be\u03b5\u03bd\u03bf\u03b4\u03bf\u03c7\u03b5\u03af\u03bf, \u03bc\u03b5\u03c4\u03b5\u03c9\u03c1\u03bf\u03bb\u03bf\u03b3\u03b9\u03ba\u03cc\u03c2, \u03ba\u03b1\u03b8\u03b1\u03c1\u03ae\n'
    u'     \u03ac\u03c1\u03b4\u03b5\u03c5\u03c3\u03b7 \u2014 \u03ba\u03c1\u03b9\u03bd\u03cc\u03c4\u03b1\u03bd \u03c9\u03c2 \u03c0\u03bb\u03ae\u03c1\u03b7\u03c2 \u03b1\u03b3\u03c1\u03bf\u03bd\u03bf\u03bc\u03b9\u03ba\u03cc\u03c2 \u03ba\u03b1\u03b9 \u03ad\u03b2\u03b3\u03b1\u03b6\u03b5 \u03c8\u03b5\u03cd\u03c4\u03b9\u03ba\u03b5\u03c2\n'
    u'     \u03b5\u03bb\u03bb\u03b5\u03af\u03c8\u03b5\u03b9\u03c2 \u03b3\u03b9\u03b1 \u03b8\u03c1\u03ad\u03c8\u03b7 \u03ba\u03b1\u03b9 \u03c6\u03c5\u03c4\u03bf\u03c0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c3\u03af\u03b1 \u03c0\u03bf\u03c5 \u03c0\u03bf\u03c4\u03ad \u03b4\u03b5\u03bd \u03b6\u03b7\u03c4\u03ae\u03b8\u03b7\u03ba\u03b1\u03bd.\n'
    u'\n'
    u'     \u03a4\u03bf `field_type` \u0394\u0395\u039d \u03c4\u03bf \u03c0\u03b5\u03b9\u03c1\u03ac\u03b6\u03bf\u03c5\u03bc\u03b5: \u03ba\u03c1\u03b1\u03c4\u03ac \u03ae\u03b4\u03b7 \u03c3\u03b7\u03bc\u03b1\u03c3\u03af\u03b1 \u00ab\u03c3\u03b5\u03c4\n'
    u'     \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03c9\u03bd\u00bb (s2120_soil_ide, soil_leaf_tree). \u039f \u03c3\u03ba\u03bf\u03c0\u03cc\u03c2 \u03c0\u03b1\u03af\u03c1\u03bd\u03b5\u03b9 \u0394\u0399\u039a\u039f \u03c4\u03bf\u03c5\n'
    u'     \u03ba\u03bb\u03b5\u03b9\u03b4\u03af, \u03b1\u03bb\u03bb\u03b9\u03ce\u03c2 \u03bf\u03b9 \u03b4\u03cd\u03bf \u03c3\u03b7\u03bc\u03b1\u03c3\u03af\u03b5\u03c2 \u03b8\u03b1 \u03c3\u03c5\u03b3\u03ba\u03c1\u03bf\u03cd\u03bf\u03bd\u03c4\u03b1\u03bd.\n'
    u'\n'
    u'     \u0391\u039d \u0397 \u03a6\u039f\u03a1\u039c\u0391 \u0394\u0395\u039d \u03a3\u03a4\u0395\u039b\u039d\u0395\u0399 \u03a4\u0399\u03a0\u039f\u03a4\u0391, \u0394\u0395\u039d \u0393\u03a1\u0391\u03a6\u0395\u03a4\u0391\u0399 tag \u03ba\u03b1\u03b9 \u03bf \u03b1\u03b3\u03c1\u03cc\u03c2\n'
    u'     \u03b2\u03b3\u03b1\u03af\u03bd\u03b5\u03b9 byte-for-byte \u03cc\u03c0\u03c9\u03c2 \u03c3\u03ae\u03bc\u03b5\u03c1\u03b1. \u039a\u03b1\u03bc\u03af\u03b1 \u03c3\u03b9\u03c9\u03c0\u03b7\u03bb\u03ae \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae. */\n'
    u'  const FIELD_PURPOSES = ["agronomy", "weather", "automation"];\n'
    u'  const _purposeRaw = String(\n'
    u'    scope.find((i) => i.variable === "field_purpose")?.value ?? ""\n'
    u'  ).trim().toLowerCase();\n'
    u'  const field_purpose = FIELD_PURPOSES.indexOf(_purposeRaw) >= 0 ? _purposeRaw : "";\n'
    u'  /* \u0386\u03b3\u03bd\u03c9\u03c3\u03c4\u03b7 \u03c4\u03b9\u03bc\u03ae \u0394\u0395\u039d \u03bc\u03b1\u03bd\u03c4\u03b5\u03cd\u03b5\u03c4\u03b1\u03b9 \u2014 \u03ba\u03b1\u03bb\u03cd\u03c4\u03b5\u03c1\u03b1 \u03ba\u03b1\u03bd\u03ad\u03bd\u03b1 tag \u03c0\u03b1\u03c1\u03ac \u03bb\u03ac\u03b8\u03bf\u03c2 tag. */\n'
    u'  if (_purposeRaw && !field_purpose) {\n'
    u'    console.log(`[field_purpose] \u0391\u0393\u039d\u03a9\u03a3\u03a4\u0397 \u03a4\u0399\u039c\u0397 "${_purposeRaw}" \u2014 \u0394\u0395\u039d \u03b3\u03c1\u03ac\u03c6\u03c4\u03b7\u03ba\u03b5 tag.`\n'
    u'      + ` \u0394\u03b5\u03ba\u03c4\u03ad\u03c2: ${FIELD_PURPOSES.join(", ")}`);\n'
    u'  }\n',
)

# ── 2. Nea parametros stin ypografi ────────────────────────────────────────
sub(
    u'async function createFieldDevice(\n'
    u'  name,\n'
    u'  accesses,\n'
    u'  clientName,\n'
    u'  clientId,\n'
    u'  field_type,\n',
    u'async function createFieldDevice(\n'
    u'  name,\n'
    u'  accesses,\n'
    u'  clientName,\n'
    u'  clientId,\n'
    u'  field_type,\n'
    u'  field_purpose,\n',
)

# ── 3. To tag, MONO an yparxei timi ────────────────────────────────────────
sub(
    u'    info.tags.push({ key: "field_type", value: String(field_type ?? "agnostic") });\n',
    u'    info.tags.push({ key: "field_type", value: String(field_type ?? "agnostic") });\n'
    u'    /* T-PROFILE-01: \u03bc\u03cc\u03bd\u03bf \u03cc\u03c4\u03b1\u03bd \u03bf \u03c7\u03c1\u03ae\u03c3\u03c4\u03b7\u03c2 \u03c4\u03bf \u03b4\u03ae\u03bb\u03c9\u03c3\u03b5. \u03a7\u03c9\u03c1\u03af\u03c2 \u03c4\u03b9\u03bc\u03ae, \u03ba\u03b1\u03bd\u03ad\u03bd\u03b1 tag:\n'
    u'       \u03b7 \u03bc\u03b7\u03c7\u03b1\u03bd\u03ae \u03c4\u03cc\u03c4\u03b5 \u03c3\u03c5\u03bc\u03c0\u03b5\u03c1\u03b9\u03c6\u03ad\u03c1\u03b5\u03c4\u03b1\u03b9 \u03cc\u03c0\u03c9\u03c2 \u03c0\u03ac\u03bd\u03c4\u03b1 (\u03c0\u03bb\u03ae\u03c1\u03b7\u03c2 \u03b1\u03b3\u03c1\u03bf\u03bd\u03bf\u03bc\u03b9\u03ba\u03cc\u03c2). */\n'
    u'    if (field_purpose) {\n'
    u'      info.tags.push({ key: "field_purpose", value: String(field_purpose) });\n'
    u'    }\n',
)

# ── 4. To simeio klisis ────────────────────────────────────────────────────
sub(
    u'    clientId,\n'
    u'    "agnostic",\n'
    u'    devicesTagObj,\n',
    u'    clientId,\n'
    u'    "agnostic",       // field_type: \u03c4\u03bf \u00ab\u03c3\u03b5\u03c4 \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03c9\u03bd\u00bb, \u03b1\u03bc\u03b5\u03c4\u03ac\u03b2\u03bb\u03b7\u03c4\u03bf\n'
    u'    field_purpose,    // T-PROFILE-01: \u03bf \u03a3\u039a\u039f\u03a0\u039f\u03a3, \u03b1\u03c0\u03cc \u03c4\u03b7 \u03c6\u03cc\u03c1\u03bc\u03b1 (\u03ba\u03b5\u03bd\u03cc = \u03cc\u03c0\u03c9\u03c2 \u03c3\u03ae\u03bc\u03b5\u03c1\u03b1)\n'
    u'    devicesTagObj,\n',
)

out = s.replace("\n", "\r\n") if _WAS_CRLF else s
io.open(P, "w", encoding="utf-8", newline="").write(out)
print("ok — 4 allages, symvasi %s diatirithike" % ("CRLF" if _WAS_CRLF else "LF"))
