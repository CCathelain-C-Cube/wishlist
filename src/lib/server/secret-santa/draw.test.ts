import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { performance } from "node:perf_hooks";
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

    it("finds a draw when the first greedy choice dead-ends", () => {
        // With an always-0 random source the giver order is b, c, d, a and b
        // tries c first. b -> c leaves d without a receiver, so it must be
        // rejected. The only valid draw is a -> b, b -> d, c -> a, d -> c.
        const ids = ["a", "b", "c", "d"];
        const exclusions: Pair[] = [
            ["a", "c"],
            ["a", "d"],
            ["b", "a"],
            ["c", "b"],
            ["c", "d"],
            ["d", "a"],
            ["d", "b"]
        ];
        const map = draw(ids, exclusions, () => 0);
        assert.ok(map);
        assertValid(map, ids, exclusions);
        assert.deepEqual(Object.fromEntries(map), { a: "b", b: "d", c: "a", d: "c" });
    });

    for (const n of [15, 30]) {
        it(`returns null quickly for an impossible draw with ${n} participants`, () => {
            const ids = Array.from({ length: n }, (_, i) => `p${i}`);
            const exclusions: Pair[] = ids.slice(1).map((id) => [id, "p0"]);
            const start = performance.now();
            const result = draw(ids, exclusions);
            const elapsed = performance.now() - start;
            console.log(`draw impossible n=${n}: ${elapsed.toFixed(2)} ms`);
            assert.equal(result, null);
            assert.ok(elapsed < 1000, `took ${elapsed} ms`);
        });
    }

    it("draws 100 participants with random exclusions quickly", () => {
        const ids = Array.from({ length: 100 }, (_, i) => `p${i}`);
        const rnd = seeded(7);
        const exclusions: Pair[] = [];
        for (const g of ids) for (const r of ids) if (g !== r && rnd(10) < 3) exclusions.push([g, r]);
        const start = performance.now();
        const map = draw(ids, exclusions);
        const elapsed = performance.now() - start;
        console.log(`draw n=100 with ${exclusions.length} exclusions: ${elapsed.toFixed(2)} ms`);
        assert.ok(map);
        assertValid(map, ids, exclusions);
        assert.ok(elapsed < 1000, `took ${elapsed} ms`);
    });

    it("draws 100 participants quickly when most edges are dead", () => {
        // Two halves: the first half may only give into the second half and
        // vice versa, except p0 who may give to anyone. Every edge from p0 into
        // its own half is in no perfect matching, so tentative picks get rejected.
        const ids = Array.from({ length: 100 }, (_, i) => `p${i}`);
        const half = (id: string) => Number(id.slice(1)) < 50;
        const exclusions: Pair[] = [];
        for (const g of ids)
            for (const r of ids) if (g !== r && g !== "p0" && half(g) === half(r)) exclusions.push([g, r]);
        const start = performance.now();
        const map = draw(ids, exclusions);
        const elapsed = performance.now() - start;
        console.log(`draw n=100 two halves: ${elapsed.toFixed(2)} ms`);
        assert.ok(map);
        assertValid(map, ids, exclusions);
        assert.ok(elapsed < 1000, `took ${elapsed} ms`);
    });

    it("agrees with brute force on small random configurations", () => {
        const rnd = seeded(123);
        const exists = (ids: string[], excluded: Set<string>, used = new Set<string>(), i = 0): boolean =>
            i === ids.length ||
            ids.some(
                (r) =>
                    r !== ids[i] &&
                    !used.has(r) &&
                    !excluded.has(`${ids[i]}>${r}`) &&
                    exists(ids, excluded, new Set([...used, r]), i + 1)
            );
        for (let round = 0; round < 300; round++) {
            const ids = Array.from({ length: 3 + rnd(4) }, (_, i) => `p${i}`);
            const exclusions: Pair[] = [];
            for (const g of ids) for (const r of ids) if (g !== r && rnd(10) < 4) exclusions.push([g, r]);
            const map = draw(ids, exclusions, rnd);
            const possible = exists(ids, new Set(exclusions.map(([g, r]) => `${g}>${r}`)));
            assert.equal(map !== null, possible);
            if (map) assertValid(map, ids, exclusions);
        }
    });
});
