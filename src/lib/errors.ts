import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { ApiError } from './esports-api';

/**
 * A message for a failed call: our own text for codes we know (errors.*), else the server's title
 * (already in plain words), else a generic line. Network failures get the offline text.
 */
export function errorText(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    const key = `errors.${err.code}`;
    if (i18n.exists(key)) return t(key as never);
    return err.message || t('common.somethingWrong');
  }
  if (err instanceof TypeError) return t('common.offline'); // fetch failed: no connection
  return t('common.somethingWrong');
}
