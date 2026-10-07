import { Hono } from "hono";
import { listTranslations, loadChapter, parseRef } from "@logoshome/bible";
import type { Env } from "../env";

export const bibleRoutes = new Hono<{ Bindings: Env }>();

bibleRoutes.get("/translations", (c) => {
  const language = c.req.query("language") as "zh" | "en" | "ja" | undefined;
  const availableOnly = c.req.query("availableOnly") === "1";
  return c.json({
    translations: listTranslations({ language, availableOnly }),
    partners: {
      endaoSso: c.env.ENDAO_SSO_ENABLED === "true",
      wereadSso: c.env.WEREAD_SSO_ENABLED === "true",
    },
  });
});

bibleRoutes.get("/chapter", async (c) => {
  const translationId = c.req.query("translation") ?? "web";
  const refRaw = c.req.query("ref") ?? "John.1";
  const ref = parseRef(refRaw);
  if (!ref) return c.json({ error: "invalid_ref" }, 400);
  const result = await loadChapter(translationId, ref, {
    endao: c.env.ENDAO_SSO_ENABLED === "true",
    weread: c.env.WEREAD_SSO_ENABLED === "true",
  });
  return c.json(result);
});
