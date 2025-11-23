import streamDeck, {
	KeyAction,
	LogLevel,
} from "@elgato/streamdeck";
import { PixelBattery } from "./actions/PixelBattery";
import { PixelRoll } from "./actions/PixelRoll";
import { PixelManager } from "./pixelHelpers/PixelManager";
import { DiscoverSettings } from "./pixelHelpers/PixelDiscover";
import { PixelDC } from "./actions/PixelDC";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.ERROR);

const pixelManager = new PixelManager();

// Register the increment action.
streamDeck.actions.registerAction(new PixelBattery(pixelManager));
streamDeck.actions.registerAction(new PixelRoll(pixelManager));
streamDeck.actions.registerAction(new PixelDC(pixelManager));

// Finally, connect to the Stream Deck.
streamDeck.connect(); 

streamDeck.settings.onDidReceiveGlobalSettings(event => {
	console.log(event);

	streamDeck.actions.filter(action => action.isKey()).forEach(key => {
		console.log(key);
	});
})