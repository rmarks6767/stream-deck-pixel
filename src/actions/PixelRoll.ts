import { DidReceiveSettingsEvent, WillAppearEvent } from "@elgato/streamdeck";
import { action } from "@elgato/streamdeck";

import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";

@action({ UUID: "com.river.pixeldie.roll" })
export class PixelRoll extends PixelDiscover<DiscoverSettings> {
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DiscoverSettings>): Promise<void> {
		await super.onDidReceiveSettings(ev);

		this.registerListener(ev);
	}

	public override async onWillAppear(ev: WillAppearEvent<DiscoverSettings>): Promise<void> {
		await super.onWillAppear(ev);

		this.registerListener(ev);
	}

	private registerListener(ev: DidReceiveSettingsEvent<DiscoverSettings> | WillAppearEvent<DiscoverSettings>) {
		console.log(`[PixelRoll.${ev.action.id}] Registering listener for ${ev.payload.settings.deviceId}`);

		if (ev.payload.settings.deviceId) {
			this.pixelManager.addEventListener(
				ev.payload.settings.deviceId,
				ev.action.id,
				"rollState",
				async (event: { state: number; faceIndex: number }) => {
					console.log(event);

					if (event.state === 1) {
						await ev.action.setTitle(`${event.faceIndex + 1}`);
					} else if (event.state === 3) {
						await ev.action.setTitle("Rolling...");
					}
				},
			);
		}
	}
}
