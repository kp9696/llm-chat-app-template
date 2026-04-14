import { describe, expect, it } from "vitest";
import { __test } from "../src/index";

describe("chat payload validation", () => {
	it("accepts valid chat message arrays", () => {
		expect(
			__test.isValidChatMessageArray([
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			]),
		).toBe(true);
	});

	it("rejects invalid chat message arrays", () => {
		expect(
			__test.isValidChatMessageArray([
				{ role: "admin", content: "Hello" },
			]),
		).toBe(false);
	});
});

describe("chunking", () => {
	it("splits content into fixed-size chunks", () => {
		expect(__test.chunkText("abcdef", 2)).toEqual(["ab", "cd", "ef"]);
	});
});
