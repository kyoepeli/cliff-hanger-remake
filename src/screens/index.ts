import type { ScreenDef } from '../sim/types.js';
import { testFixtureScreen } from './test-fixture.js';

/**
 * Screens by id. The sim worker looks screens up here (a ScreenDef holds
 * functions, so it can't be posted across the worker boundary).
 */
export const SCREENS: Record<string, ScreenDef> = {
  [testFixtureScreen.id]: testFixtureScreen,
};

export function getScreen(id: string): ScreenDef {
  const s = SCREENS[id];
  if (!s) throw new Error(`Unknown screen id: ${id}`);
  return s;
}
