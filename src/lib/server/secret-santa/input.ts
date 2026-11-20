import z from "zod";
import type { Pair } from "./draw";
import type { ExclusionInput } from "../../secret-santa-types";

export type { ExclusionInput };
export type CreateInput = {
    name: string;
    description: string | null;
    participantIds: string[];
    exclusions: ExclusionInput[];
};
export type InputErrorCode =
    | "name-required"
    | "name-too-long"
    | "description-too-long"
    | "min-participants"
    | "too-many-participants"
    | "duplicate-participant"
    | "invalid-exclusion"
    | "malformed";

const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 100;
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 10000;

const schema = z.object({
    name: z.string(),
    description: z.string().nullish(),
    participants: z.array(z.string()),
    exclusions: z.array(z.object({ giverId: z.string(), receiverId: z.string(), twoWay: z.boolean() }))
});

function parseJson(value: unknown, fallback?: unknown): unknown {
    if (value === undefined || value === "") return fallback;
    if (typeof value !== "string") return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

export function parseCreateInput(form: {
    name?: unknown;
    description?: unknown;
    participants?: unknown;
    exclusions?: unknown;
}): { ok: true; data: CreateInput } | { ok: false; code: InputErrorCode } {
    const parsed = schema.safeParse({
        name: form.name,
        description: form.description,
        participants: parseJson(form.participants),
        exclusions: parseJson(form.exclusions, [])
    });
    if (!parsed.success) return { ok: false, code: "malformed" };

    const { participants, exclusions } = parsed.data;
    const name = parsed.data.name.trim();
    if (!name) return { ok: false, code: "name-required" };
    if (name.length > MAX_NAME_LENGTH) return { ok: false, code: "name-too-long" };
    const description = parsed.data.description?.trim() || null;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, code: "description-too-long" };
    if (new Set(participants).size !== participants.length) return { ok: false, code: "duplicate-participant" };
    if (participants.length > MAX_PARTICIPANTS) return { ok: false, code: "too-many-participants" };
    if (participants.length < MIN_PARTICIPANTS) return { ok: false, code: "min-participants" };

    const ids = new Set(participants);
    if (exclusions.some((e) => e.giverId === e.receiverId || !ids.has(e.giverId) || !ids.has(e.receiverId))) {
        return { ok: false, code: "invalid-exclusion" };
    }

    return {
        ok: true,
        data: {
            name,
            description,
            participantIds: participants,
            exclusions
        }
    };
}

export function expandExclusions(rows: ExclusionInput[]): Pair[] {
    const seen = new Set<string>();
    const out: Pair[] = [];
    const add = (giver: string, receiver: string) => {
        const k = `${giver}\u0000${receiver}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push([giver, receiver]);
    };
    for (const row of rows) {
        add(row.giverId, row.receiverId);
        if (row.twoWay) add(row.receiverId, row.giverId);
    }
    return out;
}
