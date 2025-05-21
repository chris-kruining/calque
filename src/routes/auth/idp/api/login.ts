import { json, redirect } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";
import { getUser, signIn } from "~/features/auth";

export const POST = async ({ request }: APIEvent) => {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    
    if (typeof username !== 'string' || /^[a-z0-9-_]+$/.test(username) !== true) {
        return json({ error: 'Bad request' }, { status: 400 })
    }
    
    if (typeof password !== 'string' || password.length === 0) {
        return json({ error: 'Bad request' }, { status: 400 })
    }

    const user = getUser(username);

    if (user === undefined) {
        return json({ error: 'Invalid credentials' }, { status: 400 });
    }

    if (user.credential !== password) {
        return json({ error: 'Invalid credentials' }, { status: 400 });
    }

    await signIn(user);

    return redirect('/auth/client', {
        headers: {
            'Set-Login': 'logged-in',
        }
    });
};