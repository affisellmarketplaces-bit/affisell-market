import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Copy of the route error page (`app/error.tsx`), in every app language.
 *
 * `app/error.tsx` is a CLIENT component that Next ships with EVERY page (it is the root segment's error boundary). It
 * used to import the whole `messages/en.json` and `messages/fr.json` (~890 KB of text) to read five strings, so every
 * visitor downloaded and parsed both catalogues before the page became interactive. These are the same strings, kept
 * here; `lib/__tests__/app-error-copy.test.ts` fails if they drift from `messages/*.json` (`errors.page`).
 */
export type AppErrorCopy = { label: string; title: string; body: string; retry: string; home: string }

export const APP_ERROR_COPY: Record<AppLocale, AppErrorCopy> = {
  fr: {"label": "Une erreur est survenue", "title": "Un problème est survenu", "body": "Le chargement de la page a échoué. Réessayez ou revenez à l'accueil.", "retry": "Réessayer", "home": "Accueil"},
  en: {"label": "Something went wrong", "title": "We hit a snag", "body": "A problem occurred while loading this page. You can retry, or go back to the home page.", "retry": "Try again", "home": "Home"},
  de: {"label": "Ein Fehler ist aufgetreten", "title": "Ein Problem ist aufgetreten", "body": "Ein Fehler ist aufgetreten, während diese Seite geladen wurde. Sie können es erneut versuchen oder zur Startseite zurückkehren.", "retry": "Erneut versuchen", "home": "Zurück zur Startseite"},
  es: {"label": "Algo salió mal", "title": "Se nos ha producido un problema", "body": "Se ha producido un problema al cargar esta página. Puede intentarlo de nuevo o volver a la página de inicio.", "retry": "Intentarlo de nuevo", "home": "Inicio"},
  it: {"label": "È successo qualcosa", "title": "Abbiamo incontrato un problema", "body": "È stato generato un problema durante il caricamento di questa pagina. Puoi riprovare o tornare alla pagina iniziale.", "retry": "Riprova", "home": "Home"},
  nl: {"label": "Er ging iets mis", "title": "We hebben een probleem", "body": "Er is een probleem opgetreden bij het laden van deze pagina. U kunt opnieuw proberen of terug naar de homepagina gaan.", "retry": "Opnieuw proberen", "home": "Home"},
  pl: {"label": "Coś poszło nie tak", "title": "Wystąpił problem", "body": "Wystąpił błąd podczas ładowania strony. Możesz spróbować ponownie lub wrócić na stronę główną.", "retry": "Spróbuj ponownie", "home": "Domu"},
  zh: {"label": "发生错误", "title": "出现问题", "body": "页面加载时出现问题。您可以重试或返回首页。", "retry": "再试一次", "home": "首页"},
}
