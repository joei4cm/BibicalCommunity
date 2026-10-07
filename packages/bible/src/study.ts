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
];

export function listStudyMaterials(filter?: { language?: "zh" | "en" | "ja" }): StudyMaterial[] {
  if (!filter?.language) return STUDY_CATALOG;
  return STUDY_CATALOG.filter((m) => !m.language || m.language === filter.language);
}
