import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandExclusions, MAX_PARTICIPANTS, parseCreateInput } from "./input";

const base = (over: Record<string, unknown> = {}) => ({
    name: "  Xmas  ",
    description: "  ",
    participants: JSON.stringify(["a", "b", "c"]),
    exclusions: JSON.stringify([]),
    ...over
});

describe("parseCreateInput", () => {
    it("parses valid input, trims name, blank description -> null", () => {
        const r = parseCreateInput(base());
        assert.deepEqual(r, {
            ok: true,
            data: { name: "Xmas", description: null, participantIds: ["a", "b", "c"], exclusions: [] }
        });
    });

    it("keeps a non-blank description and valid exclusions", () => {
        const ex = [{ giverId: "a", receiverId: "b", twoWay: true }];
        const r = parseCreateInput(base({ description: "hi", exclusions: JSON.stringify(ex) }));
        assert.equal(r.ok && r.data.description, "hi");
        assert.deepEqual(r.ok && r.data.exclusions, ex);
    });

    it("treats omitted or empty exclusions as []", () => {
        for (const exclusions of [undefined, ""]) {
            const r = parseCreateInput(base({ exclusions }));
            assert.deepEqual(r.ok && r.data.exclusions, []);
        }
    });

    it("rejects blank name", () => {
        assert.deepEqual(parseCreateInput(base({ name: "   " })), { ok: false, code: "name-required" });
    });

    it("rejects fewer than 3 participants", () => {
        assert.deepEqual(parseCreateInput(base({ participants: JSON.stringify(["a", "b"]) })), {
            ok: false,
            code: "min-participants"
        });
    });

    it("caps participants at 100", () => {
        assert.equal(MAX_PARTICIPANTS, 100);
        const ids = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => `p${i}`));
        assert.deepEqual(parseCreateInput(base({ participants: ids(101) })), {
            ok: false,
            code: "too-many-participants"
        });
        assert.equal(parseCreateInput(base({ participants: ids(100) })).ok, true);
    });

    it("reports duplicates before the participant cap", () => {
        const dupes = JSON.stringify([...Array.from({ length: 101 }, (_, i) => `p${i}`), "p0"]);
        assert.deepEqual(parseCreateInput(base({ participants: dupes })), {
            ok: false,
            code: "duplicate-participant"
        });
    });

    it("rejects duplicate participants", () => {
        assert.deepEqual(parseCreateInput(base({ participants: JSON.stringify(["a", "a", "b"]) })), {
            ok: false,
            code: "duplicate-participant"
        });
    });

    it("rejects self exclusions and exclusions outside participants", () => {
        for (const ex of [
            { giverId: "a", receiverId: "a", twoWay: false },
            { giverId: "a", receiverId: "z", twoWay: false }
        ]) {
            assert.deepEqual(parseCreateInput(base({ exclusions: JSON.stringify([ex]) })), {
                ok: false,
                code: "invalid-exclusion"
            });
        }
    });

    it("rejects malformed JSON and wrong shapes", () => {
        for (const over of [
            { participants: "not json" },
            { participants: undefined },
            { participants: JSON.stringify([1, 2, 3]) },
            { exclusions: "{" },
            { exclusions: JSON.stringify([{ giverId: "a" }]) },
            { name: undefined }
        ]) {
            assert.deepEqual(parseCreateInput(base(over)), { ok: false, code: "malformed" });
        }
    });
});

describe("expandExclusions", () => {
    it("expands two-way rows and dedupes by first occurrence", () => {
        assert.deepEqual(
            expandExclusions([
                { giverId: "a", receiverId: "b", twoWay: true },
                { giverId: "a", receiverId: "b", twoWay: false }
            ]),
            [
                ["a", "b"],
                ["b", "a"]
            ]
        );
    });
});
