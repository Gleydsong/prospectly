/**
 * Ambient types for View Transitions API (theme liquid reveal).
 * Available in modern Chromium; optional elsewhere.
 */
interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
}

interface Document {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => ViewTransition;
}
