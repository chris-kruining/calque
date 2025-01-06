import { Component } from "solid-js";
import { internal_useI18n } from "./context";
import { locales } from "./constants";
import { ComboBox } from "~/components/combobox";
import { Dynamic } from "solid-js/web";
import css from './picker.module.css';

interface LocalePickerProps { }

export const LocalePicker: Component<LocalePickerProps> = (props) => {
    const { locale, setLocale } = internal_useI18n();

    return <ComboBox
        id="locale-picker"
        class={css.box}
        value={locale()}
        setValue={setLocale}
        values={locales}
    >
        {(locale, { flag, label }) => <Dynamic component={flag} lang={locale} aria-label={label} class={css.flag} />}
    </ComboBox>
};