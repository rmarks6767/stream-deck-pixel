import { DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { action, WillAppearEvent } from "@elgato/streamdeck";
import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";

/**
 * Action that displays the battery percentage of a Pixel Die
 */
@action({ UUID: "com.river.pixeldie.battery" })
export class PixelBattery extends PixelDiscover<DiscoverSettings> {
	public override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<DiscoverSettings>
	): Promise<void> {
		await super.onDidReceiveSettings(ev);

		this.registerListener(ev);
	}

	public override async onWillAppear(
		ev: WillAppearEvent<DiscoverSettings>
	): Promise<void> {
		await super.onWillAppear(ev);

		this.registerListener(ev);
	}

	private registerListener(
		ev:
      DidReceiveSettingsEvent<DiscoverSettings> | WillAppearEvent<DiscoverSettings>
	) {
		console.log(
      `[PixelBattery.${ev.action.id}] Registering listener for ${ev.payload.settings.deviceId}`
		);

		if (ev.payload.settings.deviceId) {
			this.pixelManager.addEventListener(
				ev.payload.settings.deviceId,
				ev.action.id,
				"batteryLevel",
				async (event: { levelPercent: number }) => {
					console.log(event);
					console.log(`Battery level: ${event.levelPercent}%`);
					// if (this.lastBatteryUpdateTime === null ||
					// (Date.now() - this.lastBatteryUpdateTime) > 60000) {
					// this.lastBatteryUpdateTime = Date.now();

					await ev.action.setTitle(`${event.levelPercent}%`);
					// }
				}
			);
		}
	}
}
