import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PixelManager } from "../pixelHelpers/PixelManagerV2";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { DCConfig, DCType, GlobalSettings } from "../common/types";
import { registerDCListener } from "../common/utils";

type DCSettings = DCConfig & DisplayActionBaseSettings;

@action({ UUID: "com.river.pixeldie.dc" })
export class DCAction extends DisplayActionBase<DCSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCSettings>): Promise<void> {
		const settings = {
			...ev.payload.settings,
			type: ev.payload.settings.type ?? DCType.standard,
			difficulty: ev.payload.settings.difficulty ?? 10,
		}
        
		// Two things need to be done here:
		// 1. Register display events for the selected device
		// 2. Update global settings to set the dc configuration for the selected device

		if(settings.deviceId) {
			const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

			const newDevice = {
				...connectedDevices?.[settings.deviceId],
				dcConfig: {
					...connectedDevices?.[settings.deviceId]?.dcConfig,
					...settings
				}
			};

			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
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
		const { type = DCType.standard, difficulty = 10 } = ev.payload.settings;
    
		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((type + 1) % enumSize) as DCType;
    
		await this.setImage(ev, newDCType);
		await ev.action.setTitle(this.formatTitle(difficulty, newDCType));
		await ev.action.setSettings({
			...ev.payload.settings,
			type: newDCType,
		});
		await ev.action.getSettings<DCSettings>();
	}

	public override async onWillAppear(ev: WillAppearEvent<DCSettings>): Promise<void> {
		if (!ev.payload.settings.deviceId) {
			return;
		}

		const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		const device = connectedDevices?.[ev.payload.settings.deviceId];
		const { difficulty = 10, type = DCType.standard } = device.dcConfig || {};

		streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>(async (gev) => {
			const updatedDevice = gev.settings.connectedDevices?.[ev.payload.settings.deviceId || ""];
			if (updatedDevice) {
				const { difficulty = 10, type = DCType.standard } = updatedDevice.dcConfig || {};
				
				console.log('New Difficulty:', difficulty, 'Type:', type);

				this.setImage(ev, type);
				ev.action.setTitle(this.formatTitle(difficulty, type));
				await this.registerListener(ev);
			}
		})

		await this.setImage(ev, type);
		await ev.action.setTitle(this.formatTitle(difficulty, type));
		await this.registerListener(ev);

		console.log(`[DCAction.${ev.action.id}] onWillAppear for device ${ev.payload.settings.deviceId}`);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DCSettings>): Promise<void> {
		await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);
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
		console.log(`[PixelRoll.${ev.action.id}] Registering listener for ${ev.payload.settings.deviceId}`);

		if (!ev.payload.settings.deviceId) {
			console.log(`[PixelRoll.${ev.action.id}] No device selected, skipping listener registration`);

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
