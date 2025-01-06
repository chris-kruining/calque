import { A } from "@solidjs/router";
import LandingImage from '../../assets/landing.svg'
import css from "./welcome.module.css";
import { useI18n } from "~/features/i18n";

export default function Welcome() {
    const { t } = useI18n();

    return <main class={css.main}>
        <LandingImage />

        <h1>{t('page.welcome.title')}</h1>
        <b>{t('page.welcome.subtitle')}</b>

        <ul>
            <li><A href="/edit">{t('page.welcome.edit')}</A></li>
            <li><A href="/instructions">{t('page.welcome.instructions')}</A></li>
            <li><A href="/about">{t('page.welcome.about')}</A></li>
        </ul>
    </main>;
}
