import { onMount } from "solid-js";

export default function Index() {
    onMount(async () => {
        try {
            // navigator.login.setStatus('logged-in');

            const credential = await navigator.credentials.get({
                identity: {
                    providers: [{
                        configURL: new URL('http://localhost:3000/fedcm.json'),
                        clientId: '/auth/client',
                        nonce: 'kaas',
                        loginHint: 'chris',
                    }],
                    mode: 'passive',
                    context: undefined,
                },
                mediation: undefined,
            });

            console.log(credential);
        } catch(e) {
            console.error(e);
        }
    });

    return 'WOOT';
}