import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toSecretSantaView, type SecretSantaRecord } from "./view";

const u = (id: string) => ({ id, name: `Name ${id}`, username: `user-${id}` });

const record = (): SecretSantaRecord => ({
    id: "s1",
    name: "Xmas",
    description: null,
    createdById: "u3",
    createdAt: new Date(0),
    participants: [
        { userId: "u1", recipientId: "u2", user: u("u1"), recipient: u("u2") },
        { userId: "u2", recipientId: "u3", user: u("u2"), recipient: u("u3") },
        { userId: "u3", recipientId: "u1", user: u("u3"), recipient: u("u1") }
    ],
    exclusions: [
        { giverId: "u1", receiverId: "u2" },
        { giverId: "u2", receiverId: "u1" }
    ]
});

describe("toSecretSantaView", () => {
    it("shows only the viewer's own recipient", () => {
        const view = toSecretSantaView(record(), "u1", false);
        assert.equal(view.isParticipant, true);
        assert.equal(view.recipient?.id, "u2");
        assert.equal(view.recipientRemoved, false);
        assert.deepEqual(view.participants, [
            { id: "u1", name: "Name u1" },
            { id: "u2", name: "Name u2" },
            { id: "u3", name: "Name u3" }
        ]);
        const json = JSON.stringify(view);
        assert.ok(!json.includes("recipientId"));
        assert.equal(json.split("user-").length - 1, 1);
    });

    it("collapses symmetric exclusions", () => {
        const view = toSecretSantaView(record(), "u1", false);
        assert.deepEqual(view.exclusions, [
            { giverId: "u1", giverName: "Name u1", receiverId: "u2", receiverName: "Name u2", twoWay: true }
        ]);
    });

    it("keeps one-way exclusions one-way", () => {
        const r = record();
        r.exclusions = [{ giverId: "u1", receiverId: "u3" }];
        assert.deepEqual(toSecretSantaView(r, "u1", false).exclusions, [
            { giverId: "u1", giverName: "Name u1", receiverId: "u3", receiverName: "Name u3", twoWay: false }
        ]);
    });

    it("non-participant manager: no recipient, can delete", () => {
        const view = toSecretSantaView(record(), "m", true);
        assert.equal(view.isParticipant, false);
        assert.equal(view.recipient, null);
        assert.equal(view.recipientRemoved, false);
        assert.equal(view.canDelete, true);
    });

    it("plain non-creator member cannot delete; creator can", () => {
        assert.equal(toSecretSantaView(record(), "u1", false).canDelete, false);
        assert.equal(toSecretSantaView(record(), "u3", false).canDelete, true);
    });

    it("flags removed recipient", () => {
        const r = record();
        r.participants[0] = { userId: "u1", recipientId: null, user: u("u1"), recipient: null };
        const view = toSecretSantaView(r, "u1", false);
        assert.equal(view.recipientRemoved, true);
        assert.equal(view.recipient, null);
    });

    it("keys exclusions by id so duplicate display names stay distinct", () => {
        const r = record();
        r.participants = r.participants.map((p) => ({ ...p, user: { ...p.user, name: "Same" } }));
        r.exclusions = [
            { giverId: "u1", receiverId: "u2" },
            { giverId: "u3", receiverId: "u2" }
        ];
        const keys = toSecretSantaView(r, "u1", false).exclusions.map((e) => `${e.giverId}>${e.receiverId}`);
        assert.deepEqual(keys, ["u1>u2", "u3>u2"]);
    });
});
