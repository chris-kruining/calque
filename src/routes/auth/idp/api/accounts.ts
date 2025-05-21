import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { assertApiSession, assertCsrf, use, User } from "~/features/auth";

export const GET = use(assertCsrf, assertApiSession, async (event: APIEvent) => {
    const user = event.locals.user as User;
    
    console.log('accounts endpoint', user);

    return json({
        accounts: [
            {
                id: user.id,
                given_name: user.givenName,
                name: `${user.givenName} ${user.familyName}`,
                email: user.username,
                picture: user.picture,
                login_hints: [user.username],
                approved_clients: user.approvedClients,
            }
        ],
    });
});