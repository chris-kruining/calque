import { json } from "@solidjs/router";
import { APIEvent } from "@solidjs/start/server";

export const GET = ({ request }: APIEvent) => {
    return json({ 
        privacy_policy_url: '/privacy-policy.txt',
        terms_of_service_url: '/terms-of-service.txt',
        icons: []
    });
};