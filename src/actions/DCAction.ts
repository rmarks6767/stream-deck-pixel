import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { DCConfig, DCType } from "../common/types";
import { GlobalSettingsController } from "../common/globalSettingsController";

const defaultSettings: DCSettings = {
	deviceId: "",
	type: DCType.standard,
	difficulty: 10,
};

type DCSettings = DCConfig & DisplayActionBaseSettings;

const dcTypeTitles = {
	[DCType.advantage]: 'Adv',
	[DCType.disadvantage]: 'Dis',
	[DCType.standard]: 'Flat'
}

@action({ UUID: "com.river.pixeldie.dc" })
export class DCAction extends DisplayActionBase<DCSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}


	// deviceId is set
	// - Add settings listener
	// - 
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onDidReceiveSettings]: Event Received`, { event: ev });

		const { connectedDevices } = await GlobalSettingsController.get();
		const device = connectedDevices?.[ev.payload.settings.deviceId || ''];

		if (!device) {
			await ev.action.setSettings(defaultSettings);
			await ev.action.setTitle('No\nDevice\nSelected');

			return;
		} 

		const updateHandler = async (type: DCType, difficulty: number) => {
			const newSettings = {
				...defaultSettings,
				difficulty,
				type
			};

			await this.registerListener({
				...ev,
				payload: {
					...ev.payload, 
					settings: newSettings
				}
			});

			await this.setImage(ev, type);
			await ev.action.setTitle(this.formatTitle(difficulty, type));
			await ev.action.setSettings(newSettings);
		}

		const newSettings = {
			...defaultSettings,
			...device.dcConfig,
		}

		
		GlobalSettingsController.addListener(ev.action.id, async (settings) => {
			const updatedDevice = settings.connectedDevices[ev.payload.settings.deviceId as string];
			if (updatedDevice) {
				await updateHandler(updatedDevice.dcConfig.type, updatedDevice.dcConfig.difficulty)
			}
		});

		await updateHandler(newSettings.type, newSettings.difficulty);
	}

	public override async onKeyDown(ev: KeyDownEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onKeyDown]: Event Received`, { event: ev });

		const { type = DCType.standard, difficulty = 10 } = ev.payload.settings;
    
		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((type + 1) % enumSize) as DCType;
    
		console.info(`[DCAction.onKeyDown]: Updating DC type from ${type} to ${newDCType}`);

		const newSettings = {
			...ev.payload.settings,
			type: newDCType,
		}

		await this.registerListener({
			...ev,
			payload: {
				...ev.payload,
				settings: newSettings
			}
		});
		await this.setImage(ev, newDCType);
		await ev.action.setTitle(this.formatTitle(difficulty, newDCType));
		await ev.action.setSettings(newSettings);
	}


	// Action Appears
	// - Add listener for DC update
	// - Add listener for saved config
	// - Set Image to DC Type
	// - Set Text to DC and DC Type
	public override async onWillAppear(ev: WillAppearEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onWillAppear]: Event Received`, { event: ev });
		
		const { connectedDevices } = await GlobalSettingsController.get();
		const device = connectedDevices?.[ev.payload.settings.deviceId || ''];

		if (!device) {
			await ev.action.setSettings(defaultSettings);
			await ev.action.setTitle('No\nDevice\nSelected');

			return;
		}

		const updateHandler = async (type: DCType, difficulty: number) => {
			const newSettings = {
				...defaultSettings,
				...ev.payload.settings,
				difficulty,
				type
			};

			await this.registerListener({
				...ev,
				payload: {
					...ev.payload, 
					settings: newSettings
				}
			});

			await this.setImage(ev, type);
			await ev.action.setTitle(this.formatTitle(difficulty, type));
			await ev.action.setSettings(newSettings);
		}

		GlobalSettingsController.addListener(ev.action.id, async (settings) => {
			const updatedDevice = settings.connectedDevices[ev.payload.settings.deviceId as string];
			if (updatedDevice) {
				await updateHandler(updatedDevice.dcConfig.type, updatedDevice.dcConfig.difficulty)
			}
		});

		await updateHandler(device.dcConfig.difficulty, device.dcConfig.type)
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DCSettings>): Promise<void> {
		console.info(`[DCAction.onWillDisappear]: Event Received`, { event: ev });

		if (ev.payload.settings.deviceId) {
			await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);
			GlobalSettingsController.removeListener(ev.action.id);
		}
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
			return `${difficulty}\n[${this.formatRoll(roll1)}]\n${dcTypeTitles[type]}`;
		}

		return `${difficulty}\n[${this.formatRoll(roll1)}][${this.formatRoll(roll2)}]\n${dcTypeTitles[type]}`;
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

	private async setImage(ev: DidReceiveSettingsEvent<DCSettings>| KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>, type: DCType) {
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






// Key is Clicked
// - Set image to new DC Type
// - Set text to DC and new DC Type
// - Set settings to include new config
// - Update listener for new settings

// DC is Updated
// - Update listener
// - Update text

// DC Change Action is clicked (DC is updated)