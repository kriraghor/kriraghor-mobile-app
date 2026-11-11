import { router } from 'expo-router';
import { HUB, SECTION_HOME, type Section } from './section';
import { sections } from './section-store';

/**
 * Leave the section for the hub, forgetting it, so the next cold start shows the hub too. The screen
 * changes at once; the small storage write finishes behind it (a slow disk must not hold a tap back).
 */
export async function goToHub() {
  const stored = sections.forget();
  router.replace(HUB);
  await stored;
}

/** Open a section from the hub and remember it for the next cold start. */
export async function openSection(section: Section) {
  const stored = sections.remember(section);
  router.replace(SECTION_HOME[section]);
  await stored;
}
