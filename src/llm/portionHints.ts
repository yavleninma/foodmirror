import { db } from "../db";
import { logError } from "../utils/logger";

const PORTION_LIMIT = 120;

/** Форматирует порции из БД для контекста LLM: "продукт: 1 cup ≈ 195 g; 1 tbsp ≈ 15 g" */
export async function getPortionHintsForLLM(): Promise<string> {
  try {
    const refs = await db.foodReference.findMany({
      where: { portionsJson: { not: null } },
      select: { displayLabel: true, portionsJson: true },
      take: PORTION_LIMIT,
    });

    const lines: string[] = [];
    for (const ref of refs) {
      const portions = ref.portionsJson as Array<{ modifier?: string; gramWeight?: number }> | null;
      if (!Array.isArray(portions) || portions.length === 0) continue;
      const parts = portions
        .filter((p) => p.modifier && p.gramWeight != null)
        .map((p) => `${p.modifier} ≈ ${Math.round(p.gramWeight!)} г`)
        .slice(0, 5);
      if (parts.length === 0) continue;
      lines.push(`${ref.displayLabel}: ${parts.join("; ")}`);
    }
    if (lines.length === 0) return "";
    return lines.join("\n");
  } catch (err) {
    await logError(
      { scope: "llm.getPortionHintsForLLM", extra: { hint: "Run prisma migrate deploy if portionsJson column is missing" } },
      err,
    );
    return "";
  }
}
