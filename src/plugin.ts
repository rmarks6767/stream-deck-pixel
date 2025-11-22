process.on('warning', (warning) => {
  // warning is an Error-like object; print full stack
  // Keep this in dev only if you want noisy output in production
  // eslint-disable-next-line no-console
  console.warn('Node warning:', warning.name, warning.message);
  // eslint-disable-next-line no-console
  console.warn(warning.stack);
});

import streamDeck, {
  LogLevel,
} from "@elgato/streamdeck";
import { PixelBattery } from "./actions/PixelBattery";
import { PixelRoll } from "./actions/PixelRoll";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the increment action.
streamDeck.actions.registerAction(new PixelBattery());
streamDeck.actions.registerAction(new PixelRoll());

// Finally, connect to the Stream Deck.
streamDeck.connect();
