import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";

export const GET = async ({ request }: APIEvent) => {
    console.log('config requested', request);

    return json({
        "accounts_endpoint": "/auth/idp/api/accounts",
        "client_metadata_endpoint": "/auth/idp/api/metadata",
        "id_assertion_endpoint": "/auth/idp/api/idtokens",
        "disconnect_endpoint": "/auth/idp/api/disconnect",
        "login_url": "/auth/idp",
        "modes": {
            "active": {
                "supports_use_other_account": true
            }
        },
        "branding": {
            "background_color": "#6200ee",
            "color": "#ffffff",
            "icons": [
            {
                "url": "/images/favicon.dark.svg",
                "size": 512
            },
            {
                "url": "/images/favicon.light.svg",
                "size": 512
            }
            ]
        }
    });
};