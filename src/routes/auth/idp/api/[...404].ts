import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";

export const GET = ({ request }: APIEvent) => {
    console.error(`url not found ${request.url}`);

    // return json({ error: `url ${request.url} is not implemented` }, { status: 404 })
};