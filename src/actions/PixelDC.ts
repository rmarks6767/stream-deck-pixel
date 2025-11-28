import streamDeck, { DidReceiveSettingsEvent, KeyDownEvent } from "@elgato/streamdeck";
import { action, WillAppearEvent } from "@elgato/streamdeck";

import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";
import { Player } from "../playSound";
import { GlobalSettings } from "../common/types";

const soundPlayer = new Player();

enum DCType {
	standard = 0,
	advantage = 1,
	disadvantage = 2,
}

interface PixelDCSettings extends DiscoverSettings {
	type?: DCType;
	difficulty?: number;
	nat20Audio?: string;
	nat1Audio?: string;
	successAudio?: string;
	failureAudio?: string;
}

@action({ UUID: "com.river.pixeldie.dc" })
export class PixelDC extends PixelDiscover<PixelDCSettings> {
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PixelDCSettings>): Promise<void> {
		await super.onDidReceiveSettings(ev);

		this.registerListener(ev);
	}

	public override async onKeyDown(ev: KeyDownEvent<PixelDCSettings>): Promise<void> {
		const { type = DCType.standard, difficulty = 10 } = ev.payload.settings;

		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((type + 1) % enumSize) as DCType;

		await this.setImage(ev, newDCType);
		await ev.action.setTitle(this.formatTitle(difficulty, newDCType));
		await ev.action.setSettings({
			...ev.payload.settings,
			type: newDCType,
		});
		this.registerListener({
			...ev,
			payload: {
				...ev.payload,
				settings: {
					...ev.payload.settings,
					type: newDCType,
				},
			},
		});
	}

	public override async onWillAppear(ev: WillAppearEvent<PixelDCSettings>): Promise<void> {
		await super.onWillAppear(ev);

		streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>(async (innerEV) => {
			console.log('WE GOT SETTINGS', innerEV, ev)

			if (ev.payload.settings.deviceId && innerEV.settings[ev.payload.settings.deviceId] !== undefined) {
				const newDifficulty = innerEV.settings[ev.payload.settings.deviceId];
				
				await ev.action.setTitle(this.formatTitle(newDifficulty, ev.payload.settings.type as DCType));
				await ev.action.setSettings({
					...ev.payload.settings,
					difficulty: newDifficulty
				});

				this.registerListener({
					...ev,
					payload: {
						...ev.payload,
						settings: {
							...ev.payload.settings,
							difficulty: newDifficulty
						},
					},
				});
			}
		});

		const { difficulty = 10, type = DCType.standard } = ev.payload.settings;

		await this.setImage(ev, type);
		await ev.action.setTitle(this.formatTitle(difficulty, type));
		this.registerListener(ev);
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

	private registerListener(
		ev: DidReceiveSettingsEvent<PixelDCSettings> | KeyDownEvent<PixelDCSettings> | WillAppearEvent<PixelDCSettings>,
	) {
		console.log(`[PixelDC.${ev.action.id}] Registering listener for ${ev.payload.settings.deviceId}`);

		const { difficulty = 10, type = DCType.standard } = ev.payload.settings;
		let rolls: number[] = [];
		let rollingTitle: string = ': ';

		if (ev.payload.settings.deviceId) {
			this.pixelManager.addEventListener(
				ev.payload.settings.deviceId,
				ev.action.id,
				"rollState",
				async (event: { state: number; faceIndex: number }) => {
					if (event.state === 1) {
						if (rolls.length === 2 || type === DCType.standard) {
							rolls = [];
						}

						rolls.push(event.faceIndex + 1);
						const [roll1, roll2] = rolls;

						await ev.action.setTitle(this.formatTitle(difficulty, type, roll1, roll2));

						switch (type) {
							case DCType.standard: {
								if (roll1 === 20 && ev.payload.settings.nat20Audio) {
									await soundPlayer.play(ev.payload.settings.nat20Audio);
								} else if (roll1 >= difficulty && ev.payload.settings.successAudio) {
									await soundPlayer.play(ev.payload.settings.successAudio);
								} else if (roll1 === 1 && ev.payload.settings.nat1Audio) {
									await soundPlayer.play(ev.payload.settings.nat1Audio);
								} else if (roll1 < difficulty && ev.payload.settings.failureAudio) {
									await soundPlayer.play(ev.payload.settings.failureAudio);
								}
								break;
							}

							case DCType.advantage: {
								if ((roll1 === 20 || roll2 === 20) && ev.payload.settings.nat20Audio) {
									await soundPlayer.play(ev.payload.settings.nat20Audio);
									await ev.action.setTitle(this.formatTitle(difficulty, type, 20, 20));
									rolls = [];
								} else if (
									((roll1 >= difficulty && !roll2) || (roll1 < difficulty && roll2 >= difficulty)) &&
									ev.payload.settings.successAudio
								) {
									await soundPlayer.play(ev.payload.settings.successAudio);
								} else if ((roll1 === 1 || roll2 === 1) && ev.payload.settings.nat1Audio) {
									await soundPlayer.play(ev.payload.settings.nat1Audio);
								} else if (roll1 < difficulty && roll2 < difficulty && ev.payload.settings.failureAudio) {
									await soundPlayer.play(ev.payload.settings.failureAudio);
								}

								break;
							}

							case DCType.disadvantage: {
								if (roll1 === 20 && roll2 === 20 && ev.payload.settings.nat20Audio) {
									await soundPlayer.play(ev.payload.settings.nat20Audio);
								} else if (roll1 >= difficulty && roll2 >= difficulty && ev.payload.settings.successAudio) {
									await soundPlayer.play(ev.payload.settings.successAudio);
								} else if ((roll1 === 1 || roll2 === 1) && ev.payload.settings.nat1Audio) {
									await soundPlayer.play(ev.payload.settings.nat1Audio);
									await ev.action.setTitle(this.formatTitle(difficulty, type, 1, 1));
									rolls = [];
								} else if (
									((roll1 < difficulty && !roll2) || (roll1 >= difficulty && roll2 < difficulty)) &&
									ev.payload.settings.failureAudio
								) {
									await soundPlayer.play(ev.payload.settings.failureAudio);
								}

								break;
							}
						}
					} else if (event.state === 3) {
						const [roll1, roll2] = rolls;

						await ev.action.setTitle(this.formatTitle(difficulty, type, roll1 || rollingTitle, roll2 || rollingTitle));

						rollingTitle = rollingTitle === ': ' ? ' :' : ': ';
					}
				},
			);
		}
	}

	private async setImage(ev: KeyDownEvent<PixelDCSettings> | WillAppearEvent<PixelDCSettings>, type: DCType) {
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
