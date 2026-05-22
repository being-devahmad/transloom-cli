import { setupNextIntl } from "./setup/nextIntlSetup.js";
import { setupI18next } from "./setup/i18nextSetup.js";

export async function setupI18n(cwd, languages, createSelector = true, framework = "nextjs") {
  if (framework === "nextjs") {
    return setupNextIntl(cwd, languages, createSelector);
  }
  return setupI18next(cwd, languages, createSelector);
}
