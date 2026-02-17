import { action, DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";

@action({ UUID: "com.river.pixeldie.roll" })
export class RollAction extends DisplayActionBase {
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
			type: "rollState",
			listener: async (event) => {
				await ev.action.setTitle(`${event.faceIndex + 1}`);
			},
		});
	}
}
