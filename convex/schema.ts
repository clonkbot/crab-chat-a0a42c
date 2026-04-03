import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  messages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("crab")),
    content: v.string(),
    audioBase64: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
