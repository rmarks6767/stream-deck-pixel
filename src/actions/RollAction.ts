import { action, DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { EventBus } from "../common/eventBus";
import { EventType, PixelRollEvent } from "../common/eventBus.types";

@action({ UUID: "com.river.pixeldie.roll" })
export class RollAction extends DisplayActionBase {
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
		super.onWillDisappear(ev);
		this.removeListeners(ev.action.id);
	}

	protected override async addListeners(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>) {
		await super.addListeners(ev, ev.type === 'didReceiveSettings');
		
		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelRoll,
			subscribeTo: ev.payload.settings.deviceId,
			listener: this.pixelListener(ev),
		});
	}
	
	protected override async removeListeners(id: string) {
		EventBus.unsubscribe(EventType.PixelRoll, id);
	}

	private pixelListener(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>) {
		let rollingTitle: string = "[: ]";
		return async ({ event: { faceIndex, state } }: PixelRollEvent) => {
			switch(state) {
				case 1: 
					await ev.action.setTitle(`${faceIndex + 1}`);
					break;
				case 3: 
					await ev.action.setTitle(rollingTitle);

					rollingTitle = rollingTitle === "[: ]" ? "[ :]" : "[: ]";
					break;
			}
		}
	}
}
