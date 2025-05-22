import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { assertApiSession, use } from "~/features/auth";

export const GET = use(assertApiSession, async ({ locals }: APIEvent) => {
    const { user } = locals;

    return json({
                id: user.id,
                given_name: user.givenName,
                name: `${user.givenName} ${user.familyName}`,
                email: user.username,
                picture: user.picture,
                login_hints: [user.username],
                approved_clients: user.approvedClients,
    });
});