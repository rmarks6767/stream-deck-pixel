import streamDeck, { SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import { JsonObject } from "@elgato/utils";
import { GlobalSettings } from "../common/types";
import { PixelManager } from "../pixelHelpers/PixelManagerV2";

interface PluginEvent extends JsonObject {
	event: "getDevices";
}

export interface DisplayActionBaseSettings extends JsonObject {
	deviceId: string;
}

export class DisplayActionBase<T extends JsonObject = JsonObject> extends SingletonAction<DisplayActionBaseSettings & T> {
	protected _pixelManager: PixelManager;

	constructor(pixelManager: PixelManager) {
		super();

		this._pixelManager = pixelManager;
	}

	public override async onSendToPlugin(ev: SendToPluginEvent<PluginEvent, DisplayActionBaseSettings>): Promise<void> {
		console.log(`[onSendToPlugin.event]: `, ev);

		if (ev.payload.event === "getDevices") {
			const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

			const items = Object.values(connectedDevices).map((device) => ({
				label: `${device.name} (${device.id})`,
				value: device.id,
			}));

			await streamDeck.ui.sendToPropertyInspector({
				event: "getDevices",
				items: [
					{
						label: "None",
						value: "",
					},
					...items,
				],
			});
		}
	}
}
