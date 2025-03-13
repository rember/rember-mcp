import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["./src/test/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [],
    globals: true,
    // Tests include calls to language models APIs
    testTimeout: 60000
  }
})
