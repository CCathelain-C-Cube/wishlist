import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draw, type Pair, type RandomInt } from "./draw";

function seeded(seed: number): RandomInt {
    let s = seed;
    return (n) => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s % n;
    };
}

function assertValid(map: Map<string, string>, ids: string[], exclusions: Pair[] = []) {
    assert.equal(map.size, ids.length);
    assert.deepEqual([...map.values()].sort(), [...ids].sort());
    for (const p of ids) assert.notEqual(map.get(p), p);
    for (const [g, r] of exclusions) assert.notEqual(map.get(g), r);
}

describe("draw", () => {
    it("assigns every participant exactly one distinct receiver, never themselves", () => {
        for (const n of [3, 4, 10]) {
            const ids = Array.from({ length: n }, (_, i) => `p${i}`);
            for (let i = 0; i < 50; i++) {
                const map = draw(ids, []);
                assert.ok(map);
                assertValid(map, ids);
            }
        }
    });

    it("honours exclusions", () => {
        const ids = ["a", "b", "c", "d"];
        const exclusions: Pair[] = [
            ["a", "b"],
            ["b", "a"]
        ];
        for (let i = 0; i < 200; i++) {
            const map = draw(ids, exclusions);
            assert.ok(map);
            assert.notEqual(map.get("a"), "b");
            assert.notEqual(map.get("b"), "a");
            assertValid(map, ids, exclusions);
        }
    });

    it("returns null when no valid draw exists", () => {
        const result = draw(
            ["a", "b", "c"],
            [
                ["a", "b"],
                ["a", "c"]
            ]
        );
        assert.equal(result, null);
    });

    it("returns null for fewer than 2 participants", () => {
        assert.equal(draw(["a"], []), null);
    });

    it("allows mutual pairs", () => {
        const ids = ["a", "b", "c", "d"];
        const map = draw(ids, [], () => 0);
        assert.ok(map);
        assertValid(map, ids);

        let mutual = false;
        for (let i = 0; i < 500 && !mutual; i++) {
            const m = draw(ids, []);
            assert.ok(m);
            mutual = ids.some((x) => {
                const y = m.get(x)!;
                return m.get(y) === x;
            });
        }
        assert.ok(mutual);
    });

    it("uses the injected random source", () => {
        const ids = ["a", "b", "c", "d", "e", "f"];
        const first = draw(ids, [], seeded(42));
        const second = draw(ids, [], seeded(42));
        assert.ok(first && second);
        assert.deepEqual([...first], [...second]);
    });
});
