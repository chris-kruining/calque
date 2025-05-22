import { onMount } from "solid-js";

export default function Index() {
    onMount(async () => {
        const user = await fetch('/auth/idp/api/user-info').then(r => r.json());

        console.log(user);

        if (user === undefined || true) {
            try {
                const credential = await navigator.credentials.get({
                    identity: {
                        providers: [{
                            configURL: new URL('http://localhost:3000/auth/idp/api/config'),
                            clientId: '/auth/client',
                            nonce: 'kaas',
                            loginHint: 'chris',
                        }],
                        mode: 'passive',
                        context: undefined,
                    },
                    mediation: 'silent',
                });

                console.log(credential);
            } catch(e) {
                console.error(e);
            }
        }
    });

    return 'WOOT';
}