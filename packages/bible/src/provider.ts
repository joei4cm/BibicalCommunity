import { buildExternalUrl, getTranslation, type TranslationMeta } from "./translations.js";
import { formatRef, type VerseRef } from "./refs.js";
import { WEB_JOHN_1 } from "./sample-web-john1.js";
import { KJV_JOHN_1 } from "./sample-kjv-john1.js";
import { ASV_JOHN_1 } from "./sample-asv-john1.js";
import { BUNGO_JOHN_1 } from "./sample-bungo-john1.js";
import { WEB_JOHN_2 } from "./packs/web-john2.js";
import { WEB_JOHN_3 } from "./packs/web-john3.js";
import { KJV_JOHN_3 } from "./packs/kjv-john3.js";
import { ASV_JOHN_3 } from "./packs/asv-john3.js";
import { WEB_PSALM_23 } from "./sample-web-ps23.js";
import { KOUGO_JOHN_1 } from "./packs/kougo-john1.js";
import { CUVT_JOHN_1 } from "./packs/cuvt-john1.js";
import { CUVS_JOHN_1 } from "./packs/cuvs-john1.js";
import { CUVS_JOHN_2 } from "./packs/cuvs-john2.js";
import { RCUV_JOHN_1 } from "./packs/rcuv-john1.js";
import { SHINKAIYAKU_JOHN_1 } from "./packs/shinkaiyaku-john1.js";
import { SHIN_KYOUDOU_JOHN_1 } from "./packs/shin-kyoudou-john1.js";
import { CCB_JOHN_1 } from "./packs/ccb-john1.js";
import { LZZ_JOHN_1 } from "./packs/lzz-john1.js";
import { KOUGO_JOHN_2 } from "./packs/kougo-john2.js";
import { KJV_JOHN_2 } from "./packs/kjv-john2.js";
import { ASV_JOHN_2 } from "./packs/asv-john2.js";
import { CUVT_JOHN_2 } from "./packs/cuvt-john2.js";
import { RCUV_JOHN_2 } from "./packs/rcuv-john2.js";
import { CCB_JOHN_2 } from "./packs/ccb-john2.js";
import { LZZ_JOHN_2 } from "./packs/lzz-john2.js";
import { SHINKAIYAKU_JOHN_2 } from "./packs/shinkaiyaku-john2.js";
import { SHIN_KYOUDOU_JOHN_2 } from "./packs/shin-kyoudou-john2.js";
import { KOUGOYAKU_PD_JOHN_2 } from "./packs/kougoyaku-pd-john2.js";
import { CUVS_JOHN_3 } from "./packs/cuvs-john3.js";
import { CUVT_JOHN_3 } from "./packs/cuvt-john3.js";
import { CUVT_JOHN_14 } from "./packs/cuvt-john14.js";
import { CUVT_JOHN_15 } from "./packs/cuvt-john15.js";
import { CUVT_MATT_5 } from "./packs/cuvt-matt5.js";
import { CUVT_MATT_6 } from "./packs/cuvt-matt6.js";
import { CUVT_GEN_1 } from "./packs/cuvt-gen1.js";
import { CUVT_PSALM_23 } from "./packs/cuvt-ps23.js";
import { CUVT_ROM_8 } from "./packs/cuvt-rom8.js";
import { CUVT_ROM_12 } from "./packs/cuvt-rom12.js";
import { CUVT_1JOHN_4 } from "./packs/cuvt-1john4.js";
import { CUVS_MATT_5 } from "./packs/cuvs-matt5.js";
import { KOUGO_MATT_5 } from "./packs/kougo-matt5.js";
import { RCUV_JOHN_3 } from "./packs/rcuv-john3.js";
import { CCB_JOHN_3 } from "./packs/ccb-john3.js";
import { LZZ_JOHN_3 } from "./packs/lzz-john3.js";
import { KOUGO_JOHN_3 } from "./packs/kougo-john3.js";
import { SHINKAIYAKU_JOHN_3 } from "./packs/shinkaiyaku-john3.js";
import { SHIN_KYOUDOU_JOHN_3 } from "./packs/shin-kyoudou-john3.js";
import { KOUGOYAKU_PD_JOHN_3 } from "./packs/kougoyaku-pd-john3.js";
import { WEB_GEN_1 } from "./packs/web-gen1.js";
import { KJV_GEN_1 } from "./packs/kjv-gen1.js";
import { ASV_GEN_1 } from "./packs/asv-gen1.js";
import { WEB_MATT_5 } from "./packs/web-matt5.js";
import { KJV_MATT_5 } from "./packs/kjv-matt5.js";
import { ASV_MATT_5 } from "./packs/asv-matt5.js";
import { WEB_MATT_6 } from "./packs/web-matt6.js";
import { KJV_MATT_6 } from "./packs/kjv-matt6.js";
import { ASV_MATT_6 } from "./packs/asv-matt6.js";
import { CUVS_MATT_6 } from "./packs/cuvs-matt6.js";
import { KOUGO_MATT_6 } from "./packs/kougo-matt6.js";
import { WEB_GAL_5 } from "./packs/web-gal5.js";
import { KJV_GAL_5 } from "./packs/kjv-gal5.js";
import { ASV_GAL_5 } from "./packs/asv-gal5.js";
import { CUVS_GAL_5 } from "./packs/cuvs-gal5.js";
import { KOUGO_GAL_5 } from "./packs/kougo-gal5.js";
import { WEB_PHIL_4 } from "./packs/web-phil4.js";
import { KJV_PHIL_4 } from "./packs/kjv-phil4.js";
import { ASV_PHIL_4 } from "./packs/asv-phil4.js";
import { CUVS_PHIL_4 } from "./packs/cuvs-phil4.js";
import { KOUGO_PHIL_4 } from "./packs/kougo-phil4.js";
import { WEB_1COR_13 } from "./packs/web-1cor13.js";
import { KJV_1COR_13 } from "./packs/kjv-1cor13.js";
import { ASV_1COR_13 } from "./packs/asv-1cor13.js";
import { CUVS_1COR_13 } from "./packs/cuvs-1cor13.js";
import { KOUGO_1COR_13 } from "./packs/kougo-1cor13.js";
import { WEB_JOHN_15 } from "./packs/web-john15.js";
import { KJV_JOHN_15 } from "./packs/kjv-john15.js";
import { ASV_JOHN_15 } from "./packs/asv-john15.js";
import { CUVS_JOHN_15 } from "./packs/cuvs-john15.js";
import { KOUGO_JOHN_15 } from "./packs/kougo-john15.js";
import { WEB_REV_21 } from "./packs/web-rev21.js";
import { KJV_REV_21 } from "./packs/kjv-rev21.js";
import { ASV_REV_21 } from "./packs/asv-rev21.js";
import { CUVS_REV_21 } from "./packs/cuvs-rev21.js";
import { KOUGO_REV_21 } from "./packs/kougo-rev21.js";
import { WEB_JAMES_1 } from "./packs/web-james1.js";
import { KJV_JAMES_1 } from "./packs/kjv-james1.js";
import { ASV_JAMES_1 } from "./packs/asv-james1.js";
import { CUVS_JAMES_1 } from "./packs/cuvs-james1.js";
import { KOUGO_JAMES_1 } from "./packs/kougo-james1.js";
import { WEB_COL_3 } from "./packs/web-col3.js";
import { KJV_COL_3 } from "./packs/kjv-col3.js";
import { ASV_COL_3 } from "./packs/asv-col3.js";
import { CUVS_COL_3 } from "./packs/cuvs-col3.js";
import { KOUGO_COL_3 } from "./packs/kougo-col3.js";
import { WEB_EPH_2 } from "./packs/web-eph2.js";
import { KJV_EPH_2 } from "./packs/kjv-eph2.js";
import { ASV_EPH_2 } from "./packs/asv-eph2.js";
import { CUVS_EPH_2 } from "./packs/cuvs-eph2.js";
import { KOUGO_EPH_2 } from "./packs/kougo-eph2.js";
import { WEB_MATT_28 } from "./packs/web-matt28.js";
import { KJV_MATT_28 } from "./packs/kjv-matt28.js";
import { ASV_MATT_28 } from "./packs/asv-matt28.js";
import { CUVS_MATT_28 } from "./packs/cuvs-matt28.js";
import { KOUGO_MATT_28 } from "./packs/kougo-matt28.js";
import { WEB_JOHN_14 } from "./packs/web-john14.js";
import { KJV_JOHN_14 } from "./packs/kjv-john14.js";
import { ASV_JOHN_14 } from "./packs/asv-john14.js";
import { CUVS_JOHN_14 } from "./packs/cuvs-john14.js";
import { KOUGO_JOHN_14 } from "./packs/kougo-john14.js";
import { RCUV_JOHN_14 } from "./packs/rcuv-john14.js";
import { RCUV_JOHN_15 } from "./packs/rcuv-john15.js";
import { RCUV_MATT_5 } from "./packs/rcuv-matt5.js";
import { RCUV_MATT_6 } from "./packs/rcuv-matt6.js";
import { RCUV_GEN_1 } from "./packs/rcuv-gen1.js";
import { RCUV_PSALM_23 } from "./packs/rcuv-ps23.js";
import { RCUV_ROM_8 } from "./packs/rcuv-rom8.js";
import { RCUV_ROM_12 } from "./packs/rcuv-rom12.js";
import { RCUV_1JOHN_4 } from "./packs/rcuv-1john4.js";
import { CCB_JOHN_14 } from "./packs/ccb-john14.js";
import { CCB_JOHN_15 } from "./packs/ccb-john15.js";
import { CCB_MATT_5 } from "./packs/ccb-matt5.js";
import { CCB_MATT_6 } from "./packs/ccb-matt6.js";
import { CCB_GEN_1 } from "./packs/ccb-gen1.js";
import { CCB_PSALM_23 } from "./packs/ccb-ps23.js";
import { CCB_ROM_8 } from "./packs/ccb-rom8.js";
import { CCB_ROM_12 } from "./packs/ccb-rom12.js";
import { CCB_1JOHN_4 } from "./packs/ccb-1john4.js";
import { LZZ_JOHN_14 } from "./packs/lzz-john14.js";
import { LZZ_JOHN_15 } from "./packs/lzz-john15.js";
import { LZZ_MATT_5 } from "./packs/lzz-matt5.js";
import { LZZ_MATT_6 } from "./packs/lzz-matt6.js";
import { LZZ_GEN_1 } from "./packs/lzz-gen1.js";
import { LZZ_PSALM_23 } from "./packs/lzz-ps23.js";
import { LZZ_ROM_8 } from "./packs/lzz-rom8.js";
import { LZZ_ROM_12 } from "./packs/lzz-rom12.js";
import { LZZ_1JOHN_4 } from "./packs/lzz-1john4.js";
import { SHINKAIYAKU_JOHN_14 } from "./packs/shinkaiyaku-john14.js";
import { SHINKAIYAKU_JOHN_15 } from "./packs/shinkaiyaku-john15.js";
import { SHINKAIYAKU_MATT_5 } from "./packs/shinkaiyaku-matt5.js";
import { SHINKAIYAKU_MATT_6 } from "./packs/shinkaiyaku-matt6.js";
import { SHINKAIYAKU_GEN_1 } from "./packs/shinkaiyaku-gen1.js";
import { SHINKAIYAKU_PSALM_23 } from "./packs/shinkaiyaku-ps23.js";
import { SHINKAIYAKU_ROM_8 } from "./packs/shinkaiyaku-rom8.js";
import { SHINKAIYAKU_ROM_12 } from "./packs/shinkaiyaku-rom12.js";
import { SHINKAIYAKU_1JOHN_4 } from "./packs/shinkaiyaku-1john4.js";
import { SHIN_KYOUDOU_JOHN_14 } from "./packs/shin-kyoudou-john14.js";
import { SHIN_KYOUDOU_JOHN_15 } from "./packs/shin-kyoudou-john15.js";
import { SHIN_KYOUDOU_MATT_5 } from "./packs/shin-kyoudou-matt5.js";
import { SHIN_KYOUDOU_MATT_6 } from "./packs/shin-kyoudou-matt6.js";
import { SHIN_KYOUDOU_GEN_1 } from "./packs/shin-kyoudou-gen1.js";
import { SHIN_KYOUDOU_PSALM_23 } from "./packs/shin-kyoudou-ps23.js";
import { SHIN_KYOUDOU_ROM_8 } from "./packs/shin-kyoudou-rom8.js";
import { SHIN_KYOUDOU_ROM_12 } from "./packs/shin-kyoudou-rom12.js";
import { SHIN_KYOUDOU_1JOHN_4 } from "./packs/shin-kyoudou-1john4.js";
import { WEB_ROM_12 } from "./packs/web-rom12.js";
import { KJV_ROM_12 } from "./packs/kjv-rom12.js";
import { ASV_ROM_12 } from "./packs/asv-rom12.js";
import { WEB_1JOHN_4 } from "./packs/web-1john4.js";
import { KJV_1JOHN_4 } from "./packs/kjv-1john4.js";
import { ASV_1JOHN_4 } from "./packs/asv-1john4.js";
import { CUVS_1JOHN_4 } from "./packs/cuvs-1john4.js";
import { KOUGO_1JOHN_4 } from "./packs/kougo-1john4.js";
import { KJV_PSALM_23 } from "./packs/kjv-ps23.js";
import { ASV_PSALM_23 } from "./packs/asv-ps23.js";
import { CUVS_GEN_1 } from "./packs/cuvs-gen1.js";
import { KOUGO_GEN_1 } from "./packs/kougo-gen1.js";
import { CUVS_PSALM_23 } from "./packs/cuvs-ps23.js";
import { KOUGO_PSALM_23 } from "./packs/kougo-ps23.js";
import { WEB_ROM_8 } from "./packs/web-rom8.js";
import { KJV_ROM_8 } from "./packs/kjv-rom8.js";
import { ASV_ROM_8 } from "./packs/asv-rom8.js";
import { CUVS_ROM_8 } from "./packs/cuvs-rom8.js";
import { KOUGO_ROM_8 } from "./packs/kougo-rom8.js";
import { WEB_HEB_11 } from "./packs/web-heb11.js";
import { KJV_HEB_11 } from "./packs/kjv-heb11.js";
import { ASV_HEB_11 } from "./packs/asv-heb11.js";
import { CUVS_HEB_11 } from "./packs/cuvs-heb11.js";
import { KOUGO_HEB_11 } from "./packs/kougo-heb11.js";
import { CUVS_ROM_12 } from "./packs/cuvs-rom12.js";
import { KOUGO_ROM_12 } from "./packs/kougo-rom12.js";
import { WEB_ISA_53 } from "./packs/web-isa53.js";
import { KJV_ISA_53 } from "./packs/kjv-isa53.js";
import { ASV_ISA_53 } from "./packs/asv-isa53.js";
import { CUVS_ISA_53 } from "./packs/cuvs-isa53.js";
import { KOUGO_ISA_53 } from "./packs/kougo-isa53.js";
import { WEB_ACTS_2 } from "./packs/web-acts2.js";
import { KJV_ACTS_2 } from "./packs/kjv-acts2.js";
import { ASV_ACTS_2 } from "./packs/asv-acts2.js";
import { CUVS_ACTS_2 } from "./packs/cuvs-acts2.js";
import { KOUGO_ACTS_2 } from "./packs/kougo-acts2.js";
import { WEB_PSALM_1 } from "./packs/web-ps1.js";
import { KJV_PSALM_1 } from "./packs/kjv-ps1.js";
import { ASV_PSALM_1 } from "./packs/asv-ps1.js";
import { CUVS_PSALM_1 } from "./packs/cuvs-ps1.js";
import { KOUGO_PSALM_1 } from "./packs/kougo-ps1.js";
import { WEB_PROV_3 } from "./packs/web-prov3.js";
import { KJV_PROV_3 } from "./packs/kjv-prov3.js";
import { ASV_PROV_3 } from "./packs/asv-prov3.js";
import { CUVS_PROV_3 } from "./packs/cuvs-prov3.js";
import { KOUGO_PROV_3 } from "./packs/kougo-prov3.js";

import { CUVT_HEB_11 } from "./packs/cuvt-heb11.js";
import { CUVT_ISA_53 } from "./packs/cuvt-isa53.js";
import { CUVT_ACTS_2 } from "./packs/cuvt-acts2.js";
import { CUVT_PSALM_1 } from "./packs/cuvt-ps1.js";
import { CUVT_PROV_3 } from "./packs/cuvt-prov3.js";
import { RCUV_HEB_11 } from "./packs/rcuv-heb11.js";
import { RCUV_ISA_53 } from "./packs/rcuv-isa53.js";
import { RCUV_ACTS_2 } from "./packs/rcuv-acts2.js";
import { RCUV_PSALM_1 } from "./packs/rcuv-ps1.js";
import { RCUV_PROV_3 } from "./packs/rcuv-prov3.js";
import { CCB_HEB_11 } from "./packs/ccb-heb11.js";
import { CCB_ISA_53 } from "./packs/ccb-isa53.js";
import { CCB_ACTS_2 } from "./packs/ccb-acts2.js";
import { CCB_PSALM_1 } from "./packs/ccb-ps1.js";
import { CCB_PROV_3 } from "./packs/ccb-prov3.js";
import { LZZ_HEB_11 } from "./packs/lzz-heb11.js";
import { LZZ_ISA_53 } from "./packs/lzz-isa53.js";
import { LZZ_ACTS_2 } from "./packs/lzz-acts2.js";
import { LZZ_PSALM_1 } from "./packs/lzz-ps1.js";
import { LZZ_PROV_3 } from "./packs/lzz-prov3.js";
import { SHINKAIYAKU_HEB_11 } from "./packs/shinkaiyaku-heb11.js";
import { SHINKAIYAKU_ISA_53 } from "./packs/shinkaiyaku-isa53.js";
import { SHINKAIYAKU_ACTS_2 } from "./packs/shinkaiyaku-acts2.js";
import { SHINKAIYAKU_PSALM_1 } from "./packs/shinkaiyaku-ps1.js";
import { SHINKAIYAKU_PROV_3 } from "./packs/shinkaiyaku-prov3.js";
import { SHIN_KYOUDOU_HEB_11 } from "./packs/shin-kyoudou-heb11.js";
import { SHIN_KYOUDOU_ISA_53 } from "./packs/shin-kyoudou-isa53.js";
import { SHIN_KYOUDOU_ACTS_2 } from "./packs/shin-kyoudou-acts2.js";
import { SHIN_KYOUDOU_PSALM_1 } from "./packs/shin-kyoudou-ps1.js";
import { SHIN_KYOUDOU_PROV_3 } from "./packs/shin-kyoudou-prov3.js";

import { CUVT_MARK_1 } from "./packs/cuvt-mark1.js";
import { CUVT_EXOD_20 } from "./packs/cuvt-exod20.js";
import { CUVT_LUKE_2 } from "./packs/cuvt-luke2.js";
import { CUVT_DEUT_6 } from "./packs/cuvt-deut6.js";
import { RCUV_MARK_1 } from "./packs/rcuv-mark1.js";
import { RCUV_EXOD_20 } from "./packs/rcuv-exod20.js";
import { RCUV_LUKE_2 } from "./packs/rcuv-luke2.js";
import { RCUV_DEUT_6 } from "./packs/rcuv-deut6.js";
import { CCB_MARK_1 } from "./packs/ccb-mark1.js";
import { CCB_EXOD_20 } from "./packs/ccb-exod20.js";
import { CCB_LUKE_2 } from "./packs/ccb-luke2.js";
import { CCB_DEUT_6 } from "./packs/ccb-deut6.js";
import { LZZ_MARK_1 } from "./packs/lzz-mark1.js";
import { LZZ_EXOD_20 } from "./packs/lzz-exod20.js";
import { LZZ_LUKE_2 } from "./packs/lzz-luke2.js";
import { LZZ_DEUT_6 } from "./packs/lzz-deut6.js";
import { SHINKAIYAKU_MARK_1 } from "./packs/shinkaiyaku-mark1.js";
import { SHINKAIYAKU_EXOD_20 } from "./packs/shinkaiyaku-exod20.js";
import { SHINKAIYAKU_LUKE_2 } from "./packs/shinkaiyaku-luke2.js";
import { SHINKAIYAKU_DEUT_6 } from "./packs/shinkaiyaku-deut6.js";
import { SHIN_KYOUDOU_MARK_1 } from "./packs/shin-kyoudou-mark1.js";
import { SHIN_KYOUDOU_EXOD_20 } from "./packs/shin-kyoudou-exod20.js";
import { SHIN_KYOUDOU_LUKE_2 } from "./packs/shin-kyoudou-luke2.js";
import { SHIN_KYOUDOU_DEUT_6 } from "./packs/shin-kyoudou-deut6.js";

import { CUVT_GAL_5 } from "./packs/cuvt-gal5.js";
import { CUVT_PHIL_4 } from "./packs/cuvt-phil4.js";
import { CUVT_1COR_13 } from "./packs/cuvt-1cor13.js";
import { CUVT_EPH_2 } from "./packs/cuvt-eph2.js";
import { CUVT_COL_3 } from "./packs/cuvt-col3.js";
import { CUVT_JAMES_1 } from "./packs/cuvt-james1.js";
import { CUVT_MATT_28 } from "./packs/cuvt-matt28.js";
import { CUVT_REV_21 } from "./packs/cuvt-rev21.js";
import { RCUV_GAL_5 } from "./packs/rcuv-gal5.js";
import { RCUV_PHIL_4 } from "./packs/rcuv-phil4.js";
import { RCUV_1COR_13 } from "./packs/rcuv-1cor13.js";
import { RCUV_EPH_2 } from "./packs/rcuv-eph2.js";
import { RCUV_COL_3 } from "./packs/rcuv-col3.js";
import { RCUV_JAMES_1 } from "./packs/rcuv-james1.js";
import { RCUV_MATT_28 } from "./packs/rcuv-matt28.js";
import { RCUV_REV_21 } from "./packs/rcuv-rev21.js";
import { CCB_GAL_5 } from "./packs/ccb-gal5.js";
import { CCB_PHIL_4 } from "./packs/ccb-phil4.js";
import { CCB_1COR_13 } from "./packs/ccb-1cor13.js";
import { CCB_EPH_2 } from "./packs/ccb-eph2.js";
import { CCB_COL_3 } from "./packs/ccb-col3.js";
import { CCB_JAMES_1 } from "./packs/ccb-james1.js";
import { CCB_MATT_28 } from "./packs/ccb-matt28.js";
import { CCB_REV_21 } from "./packs/ccb-rev21.js";
import { LZZ_GAL_5 } from "./packs/lzz-gal5.js";
import { LZZ_PHIL_4 } from "./packs/lzz-phil4.js";
import { LZZ_1COR_13 } from "./packs/lzz-1cor13.js";
import { LZZ_EPH_2 } from "./packs/lzz-eph2.js";
import { LZZ_COL_3 } from "./packs/lzz-col3.js";
import { LZZ_JAMES_1 } from "./packs/lzz-james1.js";
import { LZZ_MATT_28 } from "./packs/lzz-matt28.js";
import { LZZ_REV_21 } from "./packs/lzz-rev21.js";
import { SHINKAIYAKU_GAL_5 } from "./packs/shinkaiyaku-gal5.js";
import { SHINKAIYAKU_PHIL_4 } from "./packs/shinkaiyaku-phil4.js";
import { SHINKAIYAKU_1COR_13 } from "./packs/shinkaiyaku-1cor13.js";
import { SHINKAIYAKU_EPH_2 } from "./packs/shinkaiyaku-eph2.js";
import { SHINKAIYAKU_COL_3 } from "./packs/shinkaiyaku-col3.js";
import { SHINKAIYAKU_JAMES_1 } from "./packs/shinkaiyaku-james1.js";
import { SHINKAIYAKU_MATT_28 } from "./packs/shinkaiyaku-matt28.js";
import { SHINKAIYAKU_REV_21 } from "./packs/shinkaiyaku-rev21.js";
import { SHIN_KYOUDOU_GAL_5 } from "./packs/shin-kyoudou-gal5.js";
import { SHIN_KYOUDOU_PHIL_4 } from "./packs/shin-kyoudou-phil4.js";
import { SHIN_KYOUDOU_1COR_13 } from "./packs/shin-kyoudou-1cor13.js";
import { SHIN_KYOUDOU_EPH_2 } from "./packs/shin-kyoudou-eph2.js";
import { SHIN_KYOUDOU_COL_3 } from "./packs/shin-kyoudou-col3.js";
import { SHIN_KYOUDOU_JAMES_1 } from "./packs/shin-kyoudou-james1.js";
import { SHIN_KYOUDOU_MATT_28 } from "./packs/shin-kyoudou-matt28.js";
import { SHIN_KYOUDOU_REV_21 } from "./packs/shin-kyoudou-rev21.js";
import { WEB_MARK_1 } from "./packs/web-mark1.js";
import { KJV_MARK_1 } from "./packs/kjv-mark1.js";
import { ASV_MARK_1 } from "./packs/asv-mark1.js";
import { CUVS_MARK_1 } from "./packs/cuvs-mark1.js";
import { KOUGO_MARK_1 } from "./packs/kougo-mark1.js";
import { WEB_EXOD_20 } from "./packs/web-exod20.js";
import { KJV_EXOD_20 } from "./packs/kjv-exod20.js";
import { ASV_EXOD_20 } from "./packs/asv-exod20.js";
import { CUVS_EXOD_20 } from "./packs/cuvs-exod20.js";
import { KOUGO_EXOD_20 } from "./packs/kougo-exod20.js";
import { WEB_LUKE_2 } from "./packs/web-luke2.js";
import { KJV_LUKE_2 } from "./packs/kjv-luke2.js";
import { ASV_LUKE_2 } from "./packs/asv-luke2.js";
import { CUVS_LUKE_2 } from "./packs/cuvs-luke2.js";
import { KOUGO_LUKE_2 } from "./packs/kougo-luke2.js";
import { WEB_DEUT_6 } from "./packs/web-deut6.js";
import { KJV_DEUT_6 } from "./packs/kjv-deut6.js";
import { ASV_DEUT_6 } from "./packs/asv-deut6.js";
import { CUVS_DEUT_6 } from "./packs/cuvs-deut6.js";
import { KOUGO_DEUT_6 } from "./packs/kougo-deut6.js";

export interface ChapterPayload {
  translationId: string;
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
  source: "local" | "r2" | "external";
  externalUrl?: string;
}

export interface PartnerSsoFlags {
  endao: boolean;
  weread: boolean;
}

type VerseRow = { verse: number; text: string };

/** Normalize book aliases used by dual-pane / plans / smoke refs. */
function normalizeBookKey(book: string): string | null {
  const b = book.toLowerCase().replace(/\s+/g, "");
  if (b === "john" || book === "ヨハネ") return "john";
  if (b === "gen" || b === "genesis" || book === "创世记" || book === "創世記") return "gen";
  if (b === "matt" || b === "matthew" || b === "mt" || book === "马太福音" || book === "マタイ") {
    return "matt";
  }
  if (b === "ps" || b === "psalm" || b === "psalms" || book === "诗篇" || book === "詩篇") {
    return "ps";
  }
  if (b === "prov" || b === "proverbs" || book === "箴言") {
    return "prov";
  }
  if (b === "rom" || b === "romans" || book === "罗马书" || book === "ローマ") {
    return "rom";
  }
  if (b === "heb" || b === "hebrews" || book === "希伯来书" || book === "ヘブル") {
    return "heb";
  }
  if (b === "isa" || b === "isaiah" || book === "以赛亚书" || book === "イザヤ") {
    return "isa";
  }
  if (b === "acts" || book === "使徒行传" || book === "使徒行伝" || book === "使徒の働き") {
    return "acts";
  }
  if (b === "mark" || b === "mk" || book === "马可福音" || book === "マルコ") {
    return "mark";
  }
  if (
    b === "exod" ||
    b === "ex" ||
    b === "exodus" ||
    book === "出埃及记" ||
    book === "出エジプト記"
  ) {
    return "exod";
  }
  if (b === "luke" || b === "lk" || book === "路加福音" || book === "ルカ") {
    return "luke";
  }
  if (
    b === "deut" ||
    b === "dt" ||
    b === "deuteronomy" ||
    book === "申命记" ||
    book === "申命記"
  ) {
    return "deut";
  }
  if (b === "gal" || b === "galatians" || book === "加拉太书" || book === "ガラテヤ") {
    return "gal";
  }
  if (
    b === "phil" ||
    b === "php" ||
    b === "philippians" ||
    book === "腓立比书" ||
    book === "ピリピ"
  ) {
    return "phil";
  }
  if (
    b === "1cor" ||
    b === "1co" ||
    b === "1corinthians" ||
    book === "哥林多前书" ||
    book === "コリント人への第一の手紙" ||
    book === "コリント第一"
  ) {
    return "1cor";
  }
  if (
    b === "rev" ||
    b === "re" ||
    b === "revelation" ||
    book === "启示录" ||
    book === "啟示錄" ||
    book === "ヨハネの黙示録"
  ) {
    return "rev";
  }
  if (b === "jas" || b === "james" || book === "雅各书" || book === "ヤコブ") {
    return "jas";
  }
  if (
    b === "col" ||
    b === "colossians" ||
    book === "歌罗西书" ||
    book === "コロサイ"
  ) {
    return "col";
  }
  if (
    b === "eph" ||
    b === "ephesians" ||
    book === "以弗所书" ||
    book === "エペソ"
  ) {
    return "eph";
  }
  if (
    b === "1john" ||
    b === "1jn" ||
    b === "1jo" ||
    book === "约翰一书" ||
    book === "約翰一書" ||
    book === "ヨハネの第一の手紙"
  ) {
    return "1john";
  }
  return null;
}

function canonicalBookId(key: string): string {
  switch (key) {
    case "john":
      return "John";
    case "gen":
      return "Gen";
    case "matt":
      return "Matt";
    case "ps":
      return "Ps";
    case "prov":
      return "Prov";
    case "rom":
      return "Rom";
    case "heb":
      return "Heb";
    case "isa":
      return "Isa";
    case "acts":
      return "Acts";
    case "mark":
      return "Mark";
    case "exod":
      return "Exod";
    case "luke":
      return "Luke";
    case "deut":
      return "Deut";
    case "gal":
      return "Gal";
    case "phil":
      return "Phil";
    case "1cor":
      return "1Cor";
    case "rev":
      return "Rev";
    case "jas":
      return "Jas";
    case "col":
      return "Col";
    case "eph":
      return "Eph";
    case "1john":
      return "1John";
    default:
      return key;
  }
}

/**
 * Local PD / scaffold chapter samples for dual-pane / offline reading.
 * Keyed by translationId → bookKey → chapter → verses.
 */
const LOCAL_SAMPLES: Record<string, Record<string, Record<number, VerseRow[]>>> = {
  web: {
    john: { 1: WEB_JOHN_1, 2: WEB_JOHN_2, 3: WEB_JOHN_3, 14: WEB_JOHN_14, 15: WEB_JOHN_15 },
    gen: { 1: WEB_GEN_1 },
    matt: { 5: WEB_MATT_5, 6: WEB_MATT_6, 28: WEB_MATT_28 },
    gal: { 5: WEB_GAL_5 },
    phil: { 4: WEB_PHIL_4 },
    "1cor": { 13: WEB_1COR_13 },
    rev: { 21: WEB_REV_21 },
    jas: { 1: WEB_JAMES_1 },
    col: { 3: WEB_COL_3 },
    eph: { 2: WEB_EPH_2 },
    "1john": { 4: WEB_1JOHN_4 },
    ps: { 1: WEB_PSALM_1, 23: WEB_PSALM_23 },
    prov: { 3: WEB_PROV_3 },
    rom: { 8: WEB_ROM_8, 12: WEB_ROM_12 },
    heb: { 11: WEB_HEB_11 },
    isa: { 53: WEB_ISA_53 },
    acts: { 2: WEB_ACTS_2 },
    mark: { 1: WEB_MARK_1 },
    exod: { 20: WEB_EXOD_20 },
    luke: { 2: WEB_LUKE_2 },
    deut: { 6: WEB_DEUT_6 },
  },
  kjv: {
    john: { 1: KJV_JOHN_1, 2: KJV_JOHN_2, 3: KJV_JOHN_3, 14: KJV_JOHN_14, 15: KJV_JOHN_15 },
    gen: { 1: KJV_GEN_1 },
    matt: { 5: KJV_MATT_5, 6: KJV_MATT_6, 28: KJV_MATT_28 },
    gal: { 5: KJV_GAL_5 },
    phil: { 4: KJV_PHIL_4 },
    "1cor": { 13: KJV_1COR_13 },
    rev: { 21: KJV_REV_21 },
    jas: { 1: KJV_JAMES_1 },
    col: { 3: KJV_COL_3 },
    eph: { 2: KJV_EPH_2 },
    "1john": { 4: KJV_1JOHN_4 },
    ps: { 1: KJV_PSALM_1, 23: KJV_PSALM_23 },
    prov: { 3: KJV_PROV_3 },
    rom: { 8: KJV_ROM_8, 12: KJV_ROM_12 },
    heb: { 11: KJV_HEB_11 },
    isa: { 53: KJV_ISA_53 },
    acts: { 2: KJV_ACTS_2 },
    mark: { 1: KJV_MARK_1 },
    exod: { 20: KJV_EXOD_20 },
    luke: { 2: KJV_LUKE_2 },
    deut: { 6: KJV_DEUT_6 },
  },
  asv: {
    john: { 1: ASV_JOHN_1, 2: ASV_JOHN_2, 3: ASV_JOHN_3, 14: ASV_JOHN_14, 15: ASV_JOHN_15 },
    gen: { 1: ASV_GEN_1 },
    matt: { 5: ASV_MATT_5, 6: ASV_MATT_6, 28: ASV_MATT_28 },
    gal: { 5: ASV_GAL_5 },
    phil: { 4: ASV_PHIL_4 },
    "1cor": { 13: ASV_1COR_13 },
    rev: { 21: ASV_REV_21 },
    jas: { 1: ASV_JAMES_1 },
    col: { 3: ASV_COL_3 },
    eph: { 2: ASV_EPH_2 },
    "1john": { 4: ASV_1JOHN_4 },
    ps: { 1: ASV_PSALM_1, 23: ASV_PSALM_23 },
    prov: { 3: ASV_PROV_3 },
    rom: { 8: ASV_ROM_8, 12: ASV_ROM_12 },
    heb: { 11: ASV_HEB_11 },
    isa: { 53: ASV_ISA_53 },
    acts: { 2: ASV_ACTS_2 },
    mark: { 1: ASV_MARK_1 },
    exod: { 20: ASV_EXOD_20 },
    luke: { 2: ASV_LUKE_2 },
    deut: { 6: ASV_DEUT_6 },
  },
  "kougoyaku-pd": {
    john: { 1: BUNGO_JOHN_1, 2: KOUGOYAKU_PD_JOHN_2, 3: KOUGOYAKU_PD_JOHN_3 },
  },
  kougo: {
    john: { 1: KOUGO_JOHN_1, 2: KOUGO_JOHN_2, 3: KOUGO_JOHN_3, 14: KOUGO_JOHN_14, 15: KOUGO_JOHN_15 },
    "1john": { 4: KOUGO_1JOHN_4 },
    gen: { 1: KOUGO_GEN_1 },
    matt: { 5: KOUGO_MATT_5, 6: KOUGO_MATT_6, 28: KOUGO_MATT_28 },
    gal: { 5: KOUGO_GAL_5 },
    phil: { 4: KOUGO_PHIL_4 },
    "1cor": { 13: KOUGO_1COR_13 },
    rev: { 21: KOUGO_REV_21 },
    jas: { 1: KOUGO_JAMES_1 },
    col: { 3: KOUGO_COL_3 },
    eph: { 2: KOUGO_EPH_2 },
    ps: { 1: KOUGO_PSALM_1, 23: KOUGO_PSALM_23 },
    prov: { 3: KOUGO_PROV_3 },
    rom: { 8: KOUGO_ROM_8, 12: KOUGO_ROM_12 },
    heb: { 11: KOUGO_HEB_11 },
    isa: { 53: KOUGO_ISA_53 },
    acts: { 2: KOUGO_ACTS_2 },
    mark: { 1: KOUGO_MARK_1 },
    exod: { 20: KOUGO_EXOD_20 },
    luke: { 2: KOUGO_LUKE_2 },
    deut: { 6: KOUGO_DEUT_6 },
  },
  cuvt: {
    john: { 1: CUVT_JOHN_1, 2: CUVT_JOHN_2, 3: CUVT_JOHN_3, 14: CUVT_JOHN_14, 15: CUVT_JOHN_15 },
    matt: { 5: CUVT_MATT_5, 6: CUVT_MATT_6, 28: CUVT_MATT_28 },
    gen: { 1: CUVT_GEN_1 },
    ps: { 1: CUVT_PSALM_1, 23: CUVT_PSALM_23 },
    prov: { 3: CUVT_PROV_3 },
    rom: { 8: CUVT_ROM_8, 12: CUVT_ROM_12 },
    heb: { 11: CUVT_HEB_11 },
    isa: { 53: CUVT_ISA_53 },
    acts: { 2: CUVT_ACTS_2 },
    "1john": { 4: CUVT_1JOHN_4 },
    mark: { 1: CUVT_MARK_1 },
    exod: { 20: CUVT_EXOD_20 },
    luke: { 2: CUVT_LUKE_2 },
    gal: { 5: CUVT_GAL_5 },
    phil: { 4: CUVT_PHIL_4 },
    "1cor": { 13: CUVT_1COR_13 },
    rev: { 21: CUVT_REV_21 },
    jas: { 1: CUVT_JAMES_1 },
    col: { 3: CUVT_COL_3 },
    eph: { 2: CUVT_EPH_2 },
    deut: { 6: CUVT_DEUT_6 },
  },
  cuvs: {
    john: { 1: CUVS_JOHN_1, 2: CUVS_JOHN_2, 3: CUVS_JOHN_3, 14: CUVS_JOHN_14, 15: CUVS_JOHN_15 },
    "1john": { 4: CUVS_1JOHN_4 },
    gen: { 1: CUVS_GEN_1 },
    matt: { 5: CUVS_MATT_5, 6: CUVS_MATT_6, 28: CUVS_MATT_28 },
    gal: { 5: CUVS_GAL_5 },
    phil: { 4: CUVS_PHIL_4 },
    "1cor": { 13: CUVS_1COR_13 },
    rev: { 21: CUVS_REV_21 },
    jas: { 1: CUVS_JAMES_1 },
    col: { 3: CUVS_COL_3 },
    eph: { 2: CUVS_EPH_2 },
    ps: { 1: CUVS_PSALM_1, 23: CUVS_PSALM_23 },
    prov: { 3: CUVS_PROV_3 },
    rom: { 8: CUVS_ROM_8, 12: CUVS_ROM_12 },
    heb: { 11: CUVS_HEB_11 },
    isa: { 53: CUVS_ISA_53 },
    acts: { 2: CUVS_ACTS_2 },
    mark: { 1: CUVS_MARK_1 },
    exod: { 20: CUVS_EXOD_20 },
    luke: { 2: CUVS_LUKE_2 },
    deut: { 6: CUVS_DEUT_6 },
  },

  rcuv: {
    john: { 1: RCUV_JOHN_1, 2: RCUV_JOHN_2, 3: RCUV_JOHN_3, 14: RCUV_JOHN_14, 15: RCUV_JOHN_15 },
    matt: { 5: RCUV_MATT_5, 6: RCUV_MATT_6, 28: RCUV_MATT_28 },
    gen: { 1: RCUV_GEN_1 },
    ps: { 1: RCUV_PSALM_1, 23: RCUV_PSALM_23 },
    prov: { 3: RCUV_PROV_3 },
    rom: { 8: RCUV_ROM_8, 12: RCUV_ROM_12 },
    heb: { 11: RCUV_HEB_11 },
    isa: { 53: RCUV_ISA_53 },
    acts: { 2: RCUV_ACTS_2 },
    "1john": { 4: RCUV_1JOHN_4 },
    mark: { 1: RCUV_MARK_1 },
    exod: { 20: RCUV_EXOD_20 },
    luke: { 2: RCUV_LUKE_2 },
    gal: { 5: RCUV_GAL_5 },
    phil: { 4: RCUV_PHIL_4 },
    "1cor": { 13: RCUV_1COR_13 },
    rev: { 21: RCUV_REV_21 },
    jas: { 1: RCUV_JAMES_1 },
    col: { 3: RCUV_COL_3 },
    eph: { 2: RCUV_EPH_2 },
    deut: { 6: RCUV_DEUT_6 },
  },
  shinkaiyaku: {
    john: {
      1: SHINKAIYAKU_JOHN_1,
      2: SHINKAIYAKU_JOHN_2,
      3: SHINKAIYAKU_JOHN_3,
      14: SHINKAIYAKU_JOHN_14,
      15: SHINKAIYAKU_JOHN_15,
    },
    matt: { 5: SHINKAIYAKU_MATT_5, 6: SHINKAIYAKU_MATT_6, 28: SHINKAIYAKU_MATT_28 },
    gen: { 1: SHINKAIYAKU_GEN_1 },
    ps: { 1: SHINKAIYAKU_PSALM_1, 23: SHINKAIYAKU_PSALM_23 },
    prov: { 3: SHINKAIYAKU_PROV_3 },
    rom: { 8: SHINKAIYAKU_ROM_8, 12: SHINKAIYAKU_ROM_12 },
    heb: { 11: SHINKAIYAKU_HEB_11 },
    isa: { 53: SHINKAIYAKU_ISA_53 },
    acts: { 2: SHINKAIYAKU_ACTS_2 },
    "1john": { 4: SHINKAIYAKU_1JOHN_4 },
    mark: { 1: SHINKAIYAKU_MARK_1 },
    exod: { 20: SHINKAIYAKU_EXOD_20 },
    luke: { 2: SHINKAIYAKU_LUKE_2 },
    gal: { 5: SHINKAIYAKU_GAL_5 },
    phil: { 4: SHINKAIYAKU_PHIL_4 },
    "1cor": { 13: SHINKAIYAKU_1COR_13 },
    rev: { 21: SHINKAIYAKU_REV_21 },
    jas: { 1: SHINKAIYAKU_JAMES_1 },
    col: { 3: SHINKAIYAKU_COL_3 },
    eph: { 2: SHINKAIYAKU_EPH_2 },
    deut: { 6: SHINKAIYAKU_DEUT_6 },
  },
  shinKyoudou: {
    john: {
      1: SHIN_KYOUDOU_JOHN_1,
      2: SHIN_KYOUDOU_JOHN_2,
      3: SHIN_KYOUDOU_JOHN_3,
      14: SHIN_KYOUDOU_JOHN_14,
      15: SHIN_KYOUDOU_JOHN_15,
    },
    matt: { 5: SHIN_KYOUDOU_MATT_5, 6: SHIN_KYOUDOU_MATT_6, 28: SHIN_KYOUDOU_MATT_28 },
    gen: { 1: SHIN_KYOUDOU_GEN_1 },
    ps: { 1: SHIN_KYOUDOU_PSALM_1, 23: SHIN_KYOUDOU_PSALM_23 },
    prov: { 3: SHIN_KYOUDOU_PROV_3 },
    rom: { 8: SHIN_KYOUDOU_ROM_8, 12: SHIN_KYOUDOU_ROM_12 },
    heb: { 11: SHIN_KYOUDOU_HEB_11 },
    isa: { 53: SHIN_KYOUDOU_ISA_53 },
    acts: { 2: SHIN_KYOUDOU_ACTS_2 },
    "1john": { 4: SHIN_KYOUDOU_1JOHN_4 },
    mark: { 1: SHIN_KYOUDOU_MARK_1 },
    exod: { 20: SHIN_KYOUDOU_EXOD_20 },
    luke: { 2: SHIN_KYOUDOU_LUKE_2 },
    gal: { 5: SHIN_KYOUDOU_GAL_5 },
    phil: { 4: SHIN_KYOUDOU_PHIL_4 },
    "1cor": { 13: SHIN_KYOUDOU_1COR_13 },
    rev: { 21: SHIN_KYOUDOU_REV_21 },
    jas: { 1: SHIN_KYOUDOU_JAMES_1 },
    col: { 3: SHIN_KYOUDOU_COL_3 },
    eph: { 2: SHIN_KYOUDOU_EPH_2 },
    deut: { 6: SHIN_KYOUDOU_DEUT_6 },
  },
  ccb: {
    john: { 1: CCB_JOHN_1, 2: CCB_JOHN_2, 3: CCB_JOHN_3, 14: CCB_JOHN_14, 15: CCB_JOHN_15 },
    matt: { 5: CCB_MATT_5, 6: CCB_MATT_6, 28: CCB_MATT_28 },
    gen: { 1: CCB_GEN_1 },
    ps: { 1: CCB_PSALM_1, 23: CCB_PSALM_23 },
    prov: { 3: CCB_PROV_3 },
    rom: { 8: CCB_ROM_8, 12: CCB_ROM_12 },
    heb: { 11: CCB_HEB_11 },
    isa: { 53: CCB_ISA_53 },
    acts: { 2: CCB_ACTS_2 },
    "1john": { 4: CCB_1JOHN_4 },
    mark: { 1: CCB_MARK_1 },
    exod: { 20: CCB_EXOD_20 },
    luke: { 2: CCB_LUKE_2 },
    gal: { 5: CCB_GAL_5 },
    phil: { 4: CCB_PHIL_4 },
    "1cor": { 13: CCB_1COR_13 },
    rev: { 21: CCB_REV_21 },
    jas: { 1: CCB_JAMES_1 },
    col: { 3: CCB_COL_3 },
    eph: { 2: CCB_EPH_2 },
    deut: { 6: CCB_DEUT_6 },
  },
  lzz: {
    john: { 1: LZZ_JOHN_1, 2: LZZ_JOHN_2, 3: LZZ_JOHN_3, 14: LZZ_JOHN_14, 15: LZZ_JOHN_15 },
    matt: { 5: LZZ_MATT_5, 6: LZZ_MATT_6, 28: LZZ_MATT_28 },
    gen: { 1: LZZ_GEN_1 },
    ps: { 1: LZZ_PSALM_1, 23: LZZ_PSALM_23 },
    prov: { 3: LZZ_PROV_3 },
    rom: { 8: LZZ_ROM_8, 12: LZZ_ROM_12 },
    heb: { 11: LZZ_HEB_11 },
    isa: { 53: LZZ_ISA_53 },
    acts: { 2: LZZ_ACTS_2 },
    "1john": { 4: LZZ_1JOHN_4 },
    mark: { 1: LZZ_MARK_1 },
    exod: { 20: LZZ_EXOD_20 },
    luke: { 2: LZZ_LUKE_2 },
    gal: { 5: LZZ_GAL_5 },
    phil: { 4: LZZ_PHIL_4 },
    "1cor": { 13: LZZ_1COR_13 },
    rev: { 21: LZZ_REV_21 },
    jas: { 1: LZZ_JAMES_1 },
    col: { 3: LZZ_COL_3 },
    eph: { 2: LZZ_EPH_2 },
    deut: { 6: LZZ_DEUT_6 },
  },
};

export type ExternalChapterPayload = {
  external: true;
  url: string;
  meta: TranslationMeta;
  sso: boolean;
};

export async function loadChapter(
  translationId: string,
  ref: VerseRef,
  sso: PartnerSsoFlags = { endao: false, weread: false },
): Promise<ChapterPayload | ExternalChapterPayload> {
  const meta = getTranslation(translationId);
  if (!meta) throw new Error(`Unknown translation: ${translationId}`);

  if (meta.provider === "external") {
    const url = buildExternalUrl(meta, formatRef(ref));
    if (!url) throw new Error("Missing external URL template");
    // SSO: when partner supports cross-login, callers attach tokens; else plain deep link.
    const ssoOn = Boolean(meta.ssoFlag && sso[meta.ssoFlag]);
    if (ssoOn) {
      return { external: true, url: `${url}&sso=1`, meta, sso: true as const };
    }
    return { external: true, url, meta, sso: false as const };
  }

  const bookKey = normalizeBookKey(ref.book);
  if (bookKey) {
    const verses = LOCAL_SAMPLES[meta.id]?.[bookKey]?.[ref.chapter];
    if (verses) {
      return {
        translationId: meta.id,
        book: canonicalBookId(bookKey),
        chapter: ref.chapter,
        verses,
        source: "local",
      };
    }
  }

  if (meta.provider === "r2") {
    // R2 corpus is loaded by the API Worker (MEDIA binding). Package-level
    // callers get a stub until they fetch via /v1/bible/chapter.
    if (!meta.available) {
      throw new Error(`Translation ${translationId} not provisioned in R2 yet`);
    }
    return {
      translationId: meta.id,
      book: ref.book,
      chapter: ref.chapter,
      verses: [],
      source: "r2",
    };
  }

  return {
    translationId: meta.id,
    book: ref.book,
    chapter: ref.chapter,
    verses: [
      {
        verse: 1,
        text: `[${meta.abbreviation}] Sample placeholder for ${formatRef(ref)}. Full corpus loads from local pack or R2.`,
      },
    ],
    source: "local",
  };
}

export type LocalScaffoldRef = {
  translationId: string;
  book: string;
  chapter: number;
  ref: string;
};

/** Inventory of in-repo dual-pane / offline chapter scaffolds (not full corpora). */
export function listLocalScaffoldInventory(): LocalScaffoldRef[] {
  const out: LocalScaffoldRef[] = [];
  for (const [translationId, books] of Object.entries(LOCAL_SAMPLES)) {
    for (const [bookKey, chapters] of Object.entries(books)) {
      for (const chapter of Object.keys(chapters).map(Number)) {
        const book = canonicalBookId(bookKey);
        out.push({
          translationId,
          book,
          chapter,
          ref: `${book}.${chapter}`,
        });
      }
    }
  }
  return out.sort((a, b) =>
    a.translationId === b.translationId
      ? a.ref.localeCompare(b.ref)
      : a.translationId.localeCompare(b.translationId),
  );
}
