import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { DCConfig, DCType } from "../common/types";
import { registerDCListener } from "../common/utils";
import { GlobalSettingsController } from "../common/globalSettingsController";

const defaultSettings: DCSettings = {
	deviceId: "",
	type: DCType.standard,
	difficulty: 10,
};

type DCSettings = DCConfig & DisplayActionBaseSettings;

@action({ UUID: "com.river.pixeldie.dc" })
export class DCAction extends DisplayActionBase<DCSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onDidReceiveSettings]: Event Received`, { event: ev });

		const settings = {
			...defaultSettings,
			...ev.payload.settings,
		}
        
		// Two things need to be done here:
		// 1. Register display events for the selected device
		// 2. Update global settings to set the dc configuration for the selected device

		if(settings.deviceId) {
			const { connectedDevices } = await GlobalSettingsController.get();

			const newDevice = {
				...connectedDevices?.[settings.deviceId],
				dcConfig: {
					...connectedDevices?.[settings.deviceId]?.dcConfig,
					...settings
				}
			};

			await GlobalSettingsController.set({
				connectedDevices: {
					...connectedDevices,
					[settings.deviceId]: newDevice
				}
			});

			await registerDCListener(this._pixelManager, newDevice);
			await ev.action.setSettings(settings);
		    await this.registerListener({
				...ev,
				payload: {
					...ev.payload,
					settings
				}
			});
		}
	}

	public override async onKeyDown(ev: KeyDownEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onKeyDown]: Event Received`, { event: ev });

		const { type = DCType.standard, difficulty = 10 } = ev.payload.settings;
    
		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((type + 1) % enumSize) as DCType;
    
		console.info(`[DCAction.onKeyDown]: Updating DC type from ${type} to ${newDCType}`);

		await this.setImage(ev, newDCType);
		await ev.action.setTitle(this.formatTitle(difficulty, newDCType));
		await ev.action.setSettings({
			...ev.payload.settings,
			type: newDCType,
		});
	}

	public override async onWillAppear(ev: WillAppearEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onWillAppear]: Event Received`, { event: ev });
		
		if (!ev.payload.settings.deviceId) {
			return;
		}

		const { connectedDevices } = await GlobalSettingsController.get();
		const device = connectedDevices?.[ev.payload.settings.deviceId];

		// If we cannot find the device in our global settings
		// then we need to reset the action settings to default
		if (!device) {
			await ev.action.setSettings(defaultSettings);
			return;
		}

		const { difficulty, type} = device.dcConfig;

		// GlobalSettingsController.addListener(ev.action.id, async (settings) => {
		// 	const updatedDevice = settings.connectedDevices[ev.payload.settings.deviceId];
		// 	if (updatedDevice) {
		// 		const { difficulty, type } = updatedDevice.dcConfig;
				
		// 		this.setImage(ev, type);
		// 		ev.action.setTitle(this.formatTitle(difficulty, type));
		// 		await this.registerListener(ev);
		// 	}
		// })


		await this.setImage(ev, type);
		await ev.action.setTitle(this.formatTitle(difficulty, type));
		await this.registerListener(ev);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onWillDisappear]: Event Received`, { event: ev });

		await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);
		GlobalSettingsController.removeListener(ev.action.id);
	}

	private formatRoll(roll?: number | string) {
		if (typeof roll === 'string') {
			return roll;
		}

		if (roll) {
			return roll < 10 ? ` ${roll}` : String(roll);
		}

		return "  ";
	}

	private formatTitle(difficulty: number, type: DCType, roll1?: number | string, roll2?: number | string) {
		if (type === DCType.standard) {
			return `${difficulty}\n[${this.formatRoll(roll1)}]`;
		}

		return `${difficulty}\n[${this.formatRoll(roll1)}][${this.formatRoll(roll2)}]`;
	}

	private async registerListener(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
	) {
		console.info(`[DCAction.registerListener]: Event Received`, { event: ev });

		if (!ev.payload.settings.deviceId) {
			return;
		}

		await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);

		const { difficulty = 10, type = DCType.standard } = ev.payload.settings;
		let rolls: number[] = [];
		let rollingTitle: string = ': ';
        
		await this._pixelManager.addListener(ev.payload.settings.deviceId, {
			actionId: ev.action.id,
			type: "rollState",
			listener: async (event) => {
				if (event.state === 1) {
					if (rolls.length === 2 || type === DCType.standard) {
						rolls = [];
					}
                
					rolls.push(event.faceIndex + 1);
					const [roll1, roll2] = rolls;
                
					await ev.action.setTitle(this.formatTitle(difficulty, type, roll1, roll2));
                
					switch (type) {
						case DCType.advantage: {
							if ((roll1 === 20 || roll2 === 20)) {
								await ev.action.setTitle(this.formatTitle(difficulty, type, 20, 20));
								rolls = [];
							}
							break;
						}
						case DCType.disadvantage: {
							if ((roll1 === 1 || roll2 === 1)) {
								await ev.action.setTitle(this.formatTitle(difficulty, type, 1, 1));
								rolls = [];
							}
							break;
						}
					}
				} else if (event.state === 3) {
					if (rolls.length === 2 || type === DCType.standard) {
						rolls = [];
					}

					const [roll1, roll2] = rolls;
                
					await ev.action.setTitle(this.formatTitle(difficulty, type, roll1 || rollingTitle, roll2 || rollingTitle));
                
					rollingTitle = rollingTitle === ': ' ? ' :' : ': ';
				}
			},
		});
	}

	private async setImage(ev: KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>, type: DCType) {
		console.info(`[DCAction.setImage]: Event Received`, { event: ev });
		
		switch (type) {
			case DCType.standard:
				await ev.action.setImage("imgs/actions/standard");
				break;
			case DCType.advantage:
				await ev.action.setImage("imgs/actions/advantage");
				break;
			case DCType.disadvantage:
				await ev.action.setImage("imgs/actions/disadvantage");
		}
	}
}
