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

/**
 * Draws a receiver for every participant. Returns a giverId -> receiverId map,
 * or null when no valid assignment exists.
 */
export function draw(
    participantIds: string[],
    exclusions: Pair[],
    randomInt: RandomInt = (n) => cryptoRandomInt(n)
): Map<string, string> | null {
    if (participantIds.length < 2) return null;

    const excluded = new Set(exclusions.map(([g, r]) => key(g, r)));
    const givers = shuffle(participantIds, randomInt);
    const taken = new Set<string>();
    const result = new Map<string, string>();

    const assign = (index: number): boolean => {
        if (index === givers.length) return true;
        const giver = givers[index];
        for (const receiver of shuffle(participantIds, randomInt)) {
            if (receiver === giver || taken.has(receiver) || excluded.has(key(giver, receiver))) continue;
            taken.add(receiver);
            result.set(giver, receiver);
            if (assign(index + 1)) return true;
            taken.delete(receiver);
            result.delete(giver);
        }
        return false;
    };

    return assign(0) ? result : null;
}
