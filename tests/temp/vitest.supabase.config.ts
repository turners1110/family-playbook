import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/temp/supabase-now.test.ts"],
  },
});
