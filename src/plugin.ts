import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { PixelBattery } from "./actions/PixelBattery";
// import { PixelDC } from "./actions/PixelDC";
// import { PixelRoll } from "./actions/PixelRoll";
import { PixelManager } from "./pixelHelpers/PixelManager";
import { PixelManager as PixelManagerV2 } from "./pixelHelpers/PixelManagerV2";
// import { PixelDCCounter } from "./actions/PixelDCChange";
import { startup } from "./common/utils";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.ERROR);

const pixelManager = new PixelManager();
const pixelManagerV2 = new PixelManagerV2();

// Register the increment action.
streamDeck.actions.registerAction(new PixelBattery(pixelManager));
// streamDeck.actions.registerAction(new PixelRoll(pixelManager));
// streamDeck.actions.registerAction(new PixelDC(pixelManager));
// streamDeck.actions.registerAction(new PixelDCCounter(pixelManager));

// Finally, connect to the Stream Deck.
streamDeck.connect().then(() => startup(pixelManagerV2));
