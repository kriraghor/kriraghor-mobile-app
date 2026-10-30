import { router } from 'expo-router';
import { HUB, SECTION_HOME, type Section } from './section';
import { sections } from './section-store';

/** Leave the section for the hub, forgetting it, so the next cold start shows the hub too. */
export async function goToHub() {
  await sections.forget();
  router.replace(HUB);
}

/** Open a section from the hub and remember it for the next cold start. */
export async function openSection(section: Section) {
  await sections.remember(section);
  router.replace(SECTION_HOME[section]);
}
