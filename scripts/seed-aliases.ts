import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Seed Russian food aliases into the FoodAlias table.
 * Migrates the hardcoded FOOD_NAME_ALIASES from estimation.ts + expanded set.
 *
 * Run: npx tsx scripts/seed-aliases.ts
 */

const db = new PrismaClient();

const ALIASES: [string, string[]][] = [
  // Oils
  ["sunflower_oil", ["подсолнечное масло", "масло подсолнечное"]],
  ["olive_oil", ["оливковое масло", "масло оливковое"]],
  ["coconut_oil", ["кокосовое масло", "масло кокосовое"]],
  ["butter", ["сливочное масло", "масло сливочное"]],
  ["vegetable_oil", ["растительное масло", "масло растительное"]],
  ["sesame_oil", ["кунжутное масло", "масло кунжутное"]],
  // Grains & sides
  ["rice_cooked", ["варёный рис", "рис варёный", "рис отварной", "рис"]],
  ["buckwheat_cooked", ["гречка", "гречневая каша", "гречка варёная"]],
  ["oats", ["овсянка", "овсяная каша", "геркулес", "овсяные хлопья"]],
  ["pasta_cooked", ["макароны", "паста", "спагетти", "лапша"]],
  ["millet_cooked", ["пшено", "пшённая каша"]],
  ["barley_cooked", ["перловка", "перловая каша"]],
  ["corn_cooked", ["кукуруза варёная", "кукуруза"]],
  ["quinoa_cooked", ["киноа"]],
  ["couscous_cooked", ["кускус"]],
  // Poultry
  ["chicken_breast_cooked", ["куриная грудка", "грудка куриная", "куриное филе", "филе курицы", "курочка", "курица"]],
  ["chicken_thigh_cooked", ["куриное бедро", "бедро куриное"]],
  ["chicken_leg", ["куриная ножка", "ножка куриная", "куриная голень"]],
  ["chicken_wing", ["куриное крыло", "крылышки"]],
  ["turkey_breast", ["индейка", "грудка индейки", "филе индейки"]],
  // Meat
  ["pork_loin", ["свинина", "свиная вырезка"]],
  ["beef_ground", ["говядина", "говяжий фарш"]],
  ["lamb_leg", ["баранина", "ягнятина"]],
  // Fish & seafood
  ["salmon", ["лосось", "сёмга", "семга"]],
  ["shrimp_cooked", ["креветки", "креветка"]],
  ["cod", ["треска"]],
  ["tuna_canned", ["тунец", "тунец консервированный"]],
  ["herring", ["сельдь", "селёдка", "селедка"]],
  ["mackerel", ["скумбрия"]],
  ["trout", ["форель"]],
  // Eggs
  ["egg_whole_cooked", ["яйцо варёное", "яйцо пашот", "варёное яйцо"]],
  ["egg_whole_raw", ["яйцо", "куриное яйцо", "яйцо сырое"]],
  ["egg_fried", ["яичница", "глазунья", "жареное яйцо"]],
  // Dairy
  ["cottage_cheese", ["творог"]],
  ["sour_cream", ["сметана"]],
  ["milk_whole", ["молоко", "цельное молоко"]],
  ["yogurt", ["йогурт", "натуральный йогурт"]],
  ["kefir", ["кефир"]],
  ["ryazhenka", ["ряженка"]],
  ["cream_cheese", ["сливочный сыр", "крем-чиз"]],
  ["cheddar_cheese", ["сыр", "твёрдый сыр", "твердый сыр"]],
  ["mozzarella_cheese", ["моцарелла"]],
  ["feta_cheese", ["фета", "брынза"]],
  ["whipped_cream", ["сливки", "взбитые сливки"]],
  // Fruits
  ["banana", ["банан"]],
  ["apple", ["яблоко"]],
  ["strawberry", ["клубника"]],
  ["orange", ["апельсин"]],
  ["mandarin", ["мандарин"]],
  ["grapes", ["виноград"]],
  ["watermelon", ["арбуз"]],
  ["melon", ["дыня"]],
  ["peach", ["персик"]],
  ["pear", ["груша"]],
  ["kiwi", ["киви"]],
  ["mango", ["манго"]],
  ["pineapple", ["ананас"]],
  ["plum", ["слива"]],
  ["cherry", ["вишня", "черешня"]],
  ["blueberry", ["голубика", "черника"]],
  ["raspberry", ["малина"]],
  ["pomegranate", ["гранат"]],
  ["lemon", ["лимон"]],
  ["lime", ["лайм"]],
  ["dates", ["финики", "финик"]],
  // Vegetables
  ["tomato", ["помидор", "томат", "помидоры", "томаты"]],
  ["cucumber", ["огурец", "огурцы"]],
  ["potato_boiled", ["картошка", "картофель", "варёный картофель"]],
  ["carrot", ["морковь", "морковка"]],
  ["onion", ["лук", "репчатый лук"]],
  ["bell_pepper", ["болгарский перец", "перец сладкий"]],
  ["cabbage", ["капуста", "белокочанная капуста"]],
  ["broccoli", ["брокколи"]],
  ["cauliflower", ["цветная капуста"]],
  ["zucchini", ["кабачок", "цуккини"]],
  ["eggplant", ["баклажан"]],
  ["beetroot", ["свёкла", "свекла"]],
  ["garlic", ["чеснок"]],
  ["mushrooms", ["грибы", "шампиньоны"]],
  ["spinach", ["шпинат"]],
  ["lettuce", ["салат листовой", "латук"]],
  ["green_peas", ["зелёный горошек", "горошек"]],
  ["green_beans", ["стручковая фасоль", "зелёная фасоль"]],
  ["corn_sweet", ["сладкая кукуруза"]],
  ["radish", ["редис", "редиска"]],
  ["celery", ["сельдерей"]],
  // Legumes
  ["lentils_cooked", ["чечевица"]],
  ["chickpeas_cooked", ["нут", "хумус"]],
  ["kidney_beans_cooked", ["фасоль", "красная фасоль"]],
  // Bread & baked goods
  ["bread_white", ["белый хлеб", "хлеб белый", "батон"]],
  ["bread_wheat", ["хлеб", "пшеничный хлеб"]],
  ["bread_rye", ["чёрный хлеб", "ржаной хлеб", "бородинский"]],
  ["pita_bread", ["лаваш", "пита"]],
  ["croutons", ["сухари", "сухарики"]],
  // Nuts & seeds
  ["almonds", ["миндаль"]],
  ["walnuts", ["грецкий орех", "грецкие орехи"]],
  ["peanuts", ["арахис"]],
  ["cashews", ["кешью"]],
  ["sunflower_seeds", ["семечки", "семена подсолнечника"]],
  ["pumpkin_seeds", ["тыквенные семечки"]],
  ["hazelnuts", ["фундук"]],
  // Sweets & snacks
  ["sugar", ["сахар"]],
  ["honey", ["мёд", "мед"]],
  ["chocolate_dark", ["шоколад", "тёмный шоколад", "горький шоколад"]],
  ["chocolate_milk", ["молочный шоколад"]],
  // Drinks
  ["coffee_black", ["кофе", "чёрный кофе"]],
  ["tea_black", ["чай", "чёрный чай"]],
  ["orange_juice", ["апельсиновый сок"]],
  ["apple_juice", ["яблочный сок"]],
  // Other staples
  ["avocado", ["авокадо"]],
  ["tofu", ["тофу"]],
  ["soy_sauce", ["соевый соус"]],
  ["mayonnaise", ["майонез"]],
  ["ketchup", ["кетчуп"]],
  ["mustard", ["горчица"]],
  // Popular RU dishes (canonical names matching common USDA-style or LLM-generated)
  ["omelette", ["омлет"]],
  ["pancakes", ["блины", "блинчики", "оладьи"]],
  ["syrniki", ["сырники"]],
  ["pelmeni", ["пельмени"]],
  ["vareniki", ["вареники"]],
  ["borscht", ["борщ"]],
  ["solyanka", ["солянка"]],
  ["shchi", ["щи"]],
  ["plov", ["плов"]],
  ["olivier_salad", ["оливье", "салат оливье"]],
  ["vinaigrette_salad", ["винегрет"]],
  ["caesar_salad", ["цезарь", "салат цезарь"]],
  ["shawarma", ["шаурма", "шаверма"]],
  ["cheburek", ["чебурек", "чебуреки"]],
  ["khachapuri", ["хачапури"]],
  ["pilaf", ["плов узбекский"]],
  ["kotleta", ["котлета", "котлеты"]],
  ["goulash", ["гуляш"]],
  ["beef_stroganoff", ["бефстроганов", "бефстроганов из говядины"]],
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const [canonical, aliasList] of ALIASES) {
    const ref = await db.foodReference.findFirst({
      where: {
        OR: [
          { canonicalName: canonical },
          { canonicalName: canonical.replace(/_/g, " ") },
        ],
      },
    });

    for (const alias of aliasList) {
      const normalizedAlias = alias
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .replace(/[^\p{L}\p{N}_]/gu, "");

      if (!normalizedAlias) continue;

      try {
        if (ref) {
          await db.foodAlias.upsert({
            where: { alias_locale: { alias: normalizedAlias, locale: "ru" } },
            update: { foodReferenceId: ref.id },
            create: {
              alias: normalizedAlias,
              locale: "ru",
              foodReferenceId: ref.id,
            },
          });
        } else {
          await db.foodAlias.upsert({
            where: { alias_locale: { alias: normalizedAlias, locale: "ru" } },
            update: {},
            create: {
              alias: normalizedAlias,
              locale: "ru",
              foodReferenceId: (await getOrCreatePlaceholder(canonical)).id,
            },
          });
        }
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`Aliases seeded: ${created} created, ${skipped} skipped`);
}

async function getOrCreatePlaceholder(canonicalName: string) {
  const existing = await db.foodReference.findUnique({
    where: { canonicalName },
  });
  if (existing) return existing;

  const fallbackSource = await db.foodSource.findUnique({
    where: { name: "Internal fallback" },
  });
  if (!fallbackSource) throw new Error("Missing Internal fallback source");

  return db.foodReference.create({
    data: {
      canonicalName,
      displayLabel: canonicalName.replace(/_/g, " "),
      kcalPer100g: 0,
      proteinPer100g: 0,
      fatPer100g: 0,
      carbsPer100g: 0,
      sourceId: fallbackSource.id,
      verified: false,
      dataCompleteness: 0,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
