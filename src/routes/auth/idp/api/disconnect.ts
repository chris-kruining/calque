import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { use, assertCsrf, assertApiSession } from "~/features/auth";

export const POST = use(assertCsrf, assertApiSession, async ({ request, locals }: APIEvent) => {
    console.log(locals, request);

    return json({
        account_id: locals.user.id,
    });
});