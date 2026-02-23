import { OpenAiResponseFormat } from "./openai";

export const LLM_RESPONSE_SCHEMAS = {
  parseMeal: {
    name: "parse_meal",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              canonical_name: { type: "string" },
              display_label: { type: "string" },
              weight_g_mean: { type: ["number", "null"] },
              weight_g_min: { type: ["number", "null"] },
              weight_g_max: { type: ["number", "null"] },
              confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              confidence_reasons: {
                type: ["array", "null"],
                items: { type: "string" },
              },
              barcode: { type: ["string", "null"] },
              user_kcal_per_100g: { type: ["number", "null"] },
              user_protein_per_100g: { type: ["number", "null"] },
              user_fat_per_100g: { type: ["number", "null"] },
              user_carbs_per_100g: { type: ["number", "null"] },
            },
            required: [
              "canonical_name",
              "display_label",
              "weight_g_mean",
              "weight_g_min",
              "weight_g_max",
              "confidence",
              "confidence_reasons",
              "barcode",
              "user_kcal_per_100g",
              "user_protein_per_100g",
              "user_fat_per_100g",
              "user_carbs_per_100g",
            ],
          },
        },
        overall_confidence: { type: "number", minimum: 0, maximum: 1 },
        notes: { type: ["string", "null"] },
      },
      required: ["items", "overall_confidence", "notes"],
    },
  },
  draftReply: {
    name: "draft_reply",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { reply: { type: ["string", "null"] } },
      required: ["reply"],
    },
  },
  mealTitle: {
    name: "meal_title",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { title: { type: ["string", "null"] } },
      required: ["title"],
    },
  },
  draftChat: {
    name: "draft_chat",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reply: { type: ["string", "null"] },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              canonical_name: { type: "string" },
              display_label: { type: "string" },
              weight_g_mean: { type: ["number", "null"] },
              weight_g_min: { type: ["number", "null"] },
              weight_g_max: { type: ["number", "null"] },
              confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              confidence_reasons: {
                type: ["array", "null"],
                items: { type: "string" },
              },
              barcode: { type: ["string", "null"] },
              user_kcal_per_100g: { type: ["number", "null"] },
              user_protein_per_100g: { type: ["number", "null"] },
              user_fat_per_100g: { type: ["number", "null"] },
              user_carbs_per_100g: { type: ["number", "null"] },
            },
            required: [
              "canonical_name",
              "display_label",
              "weight_g_mean",
              "weight_g_min",
              "weight_g_max",
              "confidence",
              "confidence_reasons",
              "barcode",
              "user_kcal_per_100g",
              "user_protein_per_100g",
              "user_fat_per_100g",
              "user_carbs_per_100g",
            ],
          },
        },
        overall_confidence: { type: "number", minimum: 0, maximum: 1 },
        notes: { type: ["string", "null"] },
      },
      required: ["reply", "items", "overall_confidence", "notes"],
    },
  },
  foodReference: {
    name: "food_reference",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              kcal_per_100g: { type: ["number", "null"] },
              protein_per_100g: { type: ["number", "null"] },
              fat_per_100g: { type: ["number", "null"] },
              carbs_per_100g: { type: ["number", "null"] },
              confidence: {
                type: ["string", "null"],
                enum: ["LOW", "MEDIUM", "HIGH", null],
              },
              notes: { type: ["string", "null"] },
            },
            required: [
              "name",
              "kcal_per_100g",
              "protein_per_100g",
              "fat_per_100g",
              "carbs_per_100g",
              "confidence",
              "notes",
            ],
          },
        },
      },
      required: ["items"],
    },
  },
} as const;

export function buildJsonSchemaResponseFormat(
  key: keyof typeof LLM_RESPONSE_SCHEMAS,
): OpenAiResponseFormat {
  const { name, schema } = LLM_RESPONSE_SCHEMAS[key];
  return {
    type: "json_schema",
    json_schema: {
      name,
      strict: true,
      schema,
    },
  };
}

