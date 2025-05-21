import { json, redirect } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { useSession } from "vinxi/http";

export type Middleware = (event: APIEvent) => Response | Promise<Response> | void | Promise<void> | Promise<void | Response>;
export interface User {
    id: string;
    username: string;
    credential: string;
    givenName: string;
    familyName: string;
    picture: string;
    approvedClients: any[];
}

const USERS: User[] = [
    { id: '20d701f3-0f9f-4c21-a379-81b49f755f9e', username: 'chris', credential: 'test', givenName: 'Chris', familyName: 'Kruining', picture: '', approvedClients: [] },
    { id: '10199201-1564-47db-b67b-07088ff05de8', username: 'john', credential: 'test', givenName: 'John', familyName: 'Doe', picture: '', approvedClients: [] },
    { id: '633c44b3-8d3d-4dd1-8e1c-7de355d6dced', username: 'chris_alt', credential: 'test', givenName: 'Chris', familyName: 'Kruining', picture: '', approvedClients: [] },
    { id: 'b9759798-8a41-4961-94a6-feb2372de9cf', username: 'john_alt', credential: 'test', givenName: 'John', familyName: 'Doe', picture: '', approvedClients: [] },
];

export const getUser = (idOrUsername: string) => {
    return USERS.find(u => u.id === idOrUsername || u.username === idOrUsername);
};

export const signIn = async (user: User) => {
    const { update } = await useSession<{ signedIn?: boolean, id?: string }>({
        password: process.env.SESSION_SECRET!,
    });

    await update({ signedIn: true, id: user.id });
};

export const signOut = async () => {
    const { update } = await useSession<{ signedIn?: boolean, id?: string }>({
        password: process.env.SESSION_SECRET!,
    });

    await update({});
};

export const use = (...middlewares: Middleware[]) => {
    return (event: APIEvent) => {
        for (const handler of middlewares) {
            const response = handler(event);

            if (response !== undefined) {
                return response;
            }
        }
    };
};

export const assertCsrf: Middleware = async ({ request }: APIEvent) => {
    if (request.headers.get('Sec-Fetch-Dest') !== 'webidentity') {
        console.log('request failed the csrf test');

        return json({ error: 'Invalid access' }, { status: 400 });
    }
};

export const assertSession: Middleware = async ({ request, locals }: APIEvent) => {
    const user = await getSession();

    if (user === undefined) {
        console.log('user session not available');

        return redirect('/auth/idp', { status: 401 });
    }

    locals.user = user;
};

export const assertApiSession = async ({ request, locals }: APIEvent) => {
    const user = await getSession();

    if (user === undefined) {
        return json({ error: 'not signed in' }, { status: 401 });
    }

    locals.user = user;
};

const getSession = async () => {
    const { data } = await useSession<{ signedIn?: boolean, id?: string }>({
        password: process.env.SESSION_SECRET!,
    });

    if (data.signedIn !== true) {
        return;
    }

    return USERS.find(u => u.id === data.id);
};