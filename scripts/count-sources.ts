import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const bySource = await db.foodReference.groupBy({
    by: ["sourceId"],
    _count: true,
  });
  const sources = await db.foodSource.findMany({ select: { id: true, name: true } });
  const map = new Map(sources.map((s) => [s.id, s.name]));
  const total = await db.foodReference.count();
  console.log("By source:");
  for (const row of bySource) {
    console.log(`  ${map.get(row.sourceId) ?? "?"}: ${row._count}`);
  }
  console.log("Total FoodReference:", total);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
