import streamDeck from "@elgato/streamdeck";
import { PixelManager } from "./pixelHelpers/PixelManager";
import { startup } from "./common/utils";
import { ConnectionManagerAction } from "./actions/ConnectionManagerAction";
import { RollAction } from "./actions/RollAction";
import { DCAction } from "./actions/DCAction";
import { DCChangeAction } from "./actions/DCChangeAction";
import { BatteryAction } from "./actions/BatteryAction";

const pixelManager = new PixelManager();

streamDeck.actions.registerAction(new ConnectionManagerAction(pixelManager));
streamDeck.actions.registerAction(new BatteryAction(pixelManager));
streamDeck.actions.registerAction(new RollAction(pixelManager));
streamDeck.actions.registerAction(new DCAction(pixelManager));
streamDeck.actions.registerAction(new DCChangeAction(pixelManager));

streamDeck.logger.setLevel('error');

streamDeck.connect().then(() => startup(pixelManager));
