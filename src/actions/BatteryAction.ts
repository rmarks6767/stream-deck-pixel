import { action, DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../pixelHelpers/PixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";

@action({ UUID: "com.river.pixeldie.battery" })
export class BatteryAction extends DisplayActionBase {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.registerListener(ev);
	}

	public override async onWillAppear(ev: WillAppearEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.registerListener(ev);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DisplayActionBaseSettings>): Promise<void> {
		await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);
	}

	private async registerListener(
		ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>,
	) {
		if (!ev.payload.settings.deviceId) {
			return;
		}

		await this._pixelManager.addListener(ev.payload.settings.deviceId, {
			actionId: ev.action.id,
			type: "batteryLevel",
			listener: async ({ levelPercent }) => {
				await ev.action.setTitle(`${levelPercent}%`);
			},
		});
	}
}
