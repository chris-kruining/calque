import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { use, assertCsrf, assertApiSession } from "~/features/auth";

export const POST = use(assertCsrf, assertApiSession, async ({ request }: APIEvent) => {
    console.log('id token requested', request.url);
    
    return json({
        token: 'THIS IS A BEAUTIFUL TOKEN',
    }, {
        headers: {
            'Set-Login': 'logged-in'
        }
    });
});