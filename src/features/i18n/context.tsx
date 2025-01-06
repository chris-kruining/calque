import { Accessor, createContext, createMemo, createSignal, ParentComponent, Setter, useContext } from 'solid-js';
import { translator, flatten, Translator, Flatten } from "@solid-primitives/i18n";
import en from '~/i18n/en-GB.json';
import nl from '~/i18n/nl-NL.json';
import { makePersisted } from '@solid-primitives/storage';

type RawDictionary = typeof en;
type Dictionary = Flatten<RawDictionary>;
export type Locale = 'en-GB' | 'nl-NL';

const dictionaries = {
    'en-GB': en,
    'nl-NL': nl,
} as const;

interface I18nContextType {
    readonly t: Translator<Dictionary>;
    readonly locale: Accessor<Locale>;
    readonly setLocale: Setter<Locale>;
    readonly dictionaries: Accessor<Record<Locale, RawDictionary>>;
    readonly availableLocales: Accessor<Locale[]>;
}

const I18nContext = createContext<I18nContextType>();

export const I18nProvider: ParentComponent = (props) => {
    const [locale, setLocale, initLocale] = makePersisted(createSignal<Locale>('en-GB'), { name: 'locale' });
    const dictionary = createMemo(() => flatten(dictionaries[locale()]));
    const t = translator(dictionary);

    const ctx: I18nContextType = {
        t,
        locale,
        setLocale,
        dictionaries: createMemo(() => dictionaries),
        availableLocales: createMemo(() => Object.keys(dictionaries) as Locale[]),
    };

    return <I18nContext.Provider value={ctx}>{props.children}</I18nContext.Provider>
};

export const useI18n = () => {
    const context = useContext(I18nContext);

    if (!context) {
        throw new Error(`'useI18n' is called outside the scope of an <I18nProvider />`);
    }

    return { t: context.t, locale: context.locale };
};

export const internal_useI18n = () => {
    const context = useContext(I18nContext);

    if (!context) {
        throw new Error(`'useI18n' is called outside the scope of an <I18nProvider />`);
    }

    return context;
};