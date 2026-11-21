import { randomInt as cryptoRandomInt } from "node:crypto";

export type Pair = readonly [giverId: string, receiverId: string];
export type RandomInt = (maxExclusive: number) => number;

const key = (giver: string, receiver: string) => `${giver}\u0000${receiver}`;

function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const FREE = -1;

/**
 * Draws a receiver for every participant. Returns a giverId -> receiverId map,
 * or null when no valid assignment exists.
 *
 * The draw is modelled as a bipartite perfect matching between givers and
 * receivers (an edge means "may give to": not self, not excluded). A perfect
 * matching is computed up front with Kuhn's augmenting paths; if none exists
 * the draw is impossible. Then, for each giver in random order, receivers are
 * tried in random order and a choice is only accepted when the remaining
 * givers can still be matched, so no dead end is ever entered. Every step is
 * polynomial: O(V * E) for the initial matching and O(E) per tentative choice.
 */
export function draw(
    participantIds: string[],
    exclusions: Pair[],
    randomInt: RandomInt = (n) => cryptoRandomInt(n)
): Map<string, string> | null {
    const n = participantIds.length;
    if (n < 2) return null;

    const excluded = new Set(exclusions.map(([g, r]) => key(g, r)));
    const allowed: number[][] = participantIds.map((giver, g) =>
        participantIds.flatMap((receiver, r) => (r === g || excluded.has(key(giver, receiver)) ? [] : [r]))
    );

    // receiverOf[giver] / giverOf[receiver]: the current perfect matching.
    const receiverOf = new Array<number>(n).fill(FREE);
    const giverOf = new Array<number>(n).fill(FREE);
    const fixed = new Array<boolean>(n).fill(false);
    let visited = new Array<boolean>(n).fill(false);

    // Tries to find an alternating path from `giver` to a free receiver, only
    // moving givers that are not fixed yet. Re-points the matching on success.
    const augment = (giver: number): boolean => {
        for (const r of allowed[giver]) {
            if (visited[r]) continue;
            visited[r] = true;
            const owner = giverOf[r];
            if (owner === FREE || (!fixed[owner] && augment(owner))) {
                receiverOf[giver] = r;
                giverOf[r] = giver;
                return true;
            }
        }
        return false;
    };

    // (a) Feasibility: build any perfect matching, or give up.
    for (let g = 0; g < n; g++) {
        visited = new Array<boolean>(n).fill(false);
        if (!augment(g)) return null;
    }

    // (b) Randomised assignment that never enters a dead subtree.
    const giverOrder = shuffle(
        participantIds.map((_, i) => i),
        randomInt
    );
    for (const giver of giverOrder) {
        for (const receiver of shuffle(allowed[giver], randomInt)) {
            const owner = giverOf[receiver];
            if (owner !== FREE && fixed[owner]) continue;
            if (owner === giver) {
                fixed[giver] = true;
                break;
            }

            // Tentatively move `giver` onto `receiver`. Its old receiver becomes
            // free and the displaced owner must find a new one.
            const savedReceiverOf = [...receiverOf];
            const savedGiverOf = [...giverOf];
            const previous = receiverOf[giver];
            giverOf[previous] = FREE;
            receiverOf[giver] = receiver;
            giverOf[receiver] = giver;
            fixed[giver] = true;
            receiverOf[owner] = FREE;
            visited = new Array<boolean>(n).fill(false);
            visited[receiver] = true;
            if (augment(owner)) break;

            fixed[giver] = false;
            receiverOf.splice(0, n, ...savedReceiverOf);
            giverOf.splice(0, n, ...savedGiverOf);
        }
        // The current matching always gives `giver` a valid option, so it is
        // fixed by the loop above at the latest when its matched receiver
        // comes up.
    }

    return new Map(participantIds.map((id, g) => [id, participantIds[receiverOf[g]]]));
}
