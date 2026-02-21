import { action, DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { wait } from "../common/utils";

@action({ UUID: "com.river.pixeldie.battery" })
export class BatteryAction extends DisplayActionBase {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.addListeners(ev);
	}

	public override async onWillAppear(ev: WillAppearEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.addListeners(ev);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DisplayActionBaseSettings>): Promise<void> {
		this.removeListeners(ev.action.id);
	}

	private async addListeners(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>) {
		if (!ev.payload.settings.deviceId) {
			await ev.action.showAlert();
			await ev.action.setTitle('No\nDevice');
			this.removeListeners(ev.action.id);
			
			return;
		}
		
		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelBattery,
			subscribeTo: ev.payload.settings.deviceId,
			listener: async ({ event: { levelPercent } }) => {
				await ev.action.setTitle(`${levelPercent}%`);
			},
		});

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelDisconnect,
			subscribeTo: ev.payload.settings.deviceId,
			listener: async () => {
				await ev.action.showAlert();
				await ev.action.setTitle('No\nDevice');
			},
		});

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelConnect,
			subscribeTo: ev.payload.settings.deviceId,
			listener: async () => {
				await ev.action.setTitle('Device\nConnected');
				await wait(1_000);
				await ev.action.setTitle('D20');
			},
		});
	}

	private async removeListeners(id: string) {
		EventBus.unsubscribe(EventType.PixelBattery, id);
		EventBus.unsubscribe(EventType.PixelConnect, id);
		EventBus.unsubscribe(EventType.PixelDisconnect, id);
	}
}
