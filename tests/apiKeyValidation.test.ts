import { describe, it, expect } from "vitest";
import { validateApiKeyLogic } from "app/services/gemini.ts";

describe("validateApiKeyLogic", () => {
  it("throws when key is empty", () => {
    expect(() => validateApiKeyLogic("")).toThrow(
      "API key is required. Set GEMINI_API_KEY in localStorage or use the key selector in the app header."
    );
  });

  it("throws when key is too short (< 10 chars)", () => {
    expect(() => validateApiKeyLogic("short")).toThrow(
      "API key is required. Set GEMINI_API_KEY in localStorage or use the key selector in the app header."
    );
    expect(() => validateApiKeyLogic("123456789")).toThrow();
  });

  it("does not throw when key is valid (>= 10 chars)", () => {
    expect(() => validateApiKeyLogic("1234567890")).not.toThrow();
    expect(() => validateApiKeyLogic("a".repeat(20))).not.toThrow();
  });
});
