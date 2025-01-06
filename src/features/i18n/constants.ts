import { Locale } from "./context";

import Flag_en_GB from 'flag-icons/flags/4x3/gb.svg';
import Flag_nl_NL from 'flag-icons/flags/4x3/nl.svg';

export const locales: Record<Locale, { label: string, flag: any }> = {
    'en-GB': { label: 'English', flag: Flag_en_GB },
    'nl-NL': { label: 'Nederlands', flag: Flag_nl_NL },
} as const;