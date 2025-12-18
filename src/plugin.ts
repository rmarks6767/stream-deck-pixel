import streamDeck from "@elgato/streamdeck";
// import { PixelBattery } from "./actions/PixelBattery";
// import { PixelDC } from "./actions/PixelDC";
// import { PixelManager } from "./pixelHelpers/PixelManager";
import { PixelManager as PixelManagerV2 } from "./pixelHelpers/PixelManagerV2";
// import { PixelDCCounter } from "./actions/PixelDCChange";
import { startup } from "./common/utils";
import { ConnectAction } from "./actions/ConnectAction";
import { RollAction } from "./actions/RollAction";
import { DCAction } from "./actions/DCAction";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel('error');

// const pixelManager = new PixelManager();
const pixelManagerV2 = new PixelManagerV2();

// Register the increment action.
streamDeck.actions.registerAction(new ConnectAction(pixelManagerV2));
streamDeck.actions.registerAction(new RollAction(pixelManagerV2));
streamDeck.actions.registerAction(new DCAction(pixelManagerV2));
// streamDeck.actions.registerAction(new PixelDCCounter(pixelManager));

// Finally, connect to the Stream Deck.
streamDeck.connect().then(() => startup(pixelManagerV2));
