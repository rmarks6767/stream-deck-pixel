import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import z from "zod";

import { EventBus } from "../common/eventBus";
import { EventType, PixelRollEvent } from "../common/eventBus.types";
import { PixelManager } from "../common/pixelManager";
import { DCType } from "../common/types";
import { DisplayActionBase } from "./DisplayActionBase";
import { soundPlayer } from "../playSound";

const Settings = z.object({
	deviceId: z.string().default(""),
	type: z.enum(DCType).default(DCType.standard),
	difficulty: z.number().default(10),
	nat20Audio: z.string().default(""),
	nat1Audio: z.string().default(""),
	successAudio: z.string().default(""),
	failureAudio: z.string().default(""),
});

type DCSettings = z.infer<typeof Settings>;

const dcTypeTitles = {
	[DCType.advantage]: "Adv",
	[DCType.disadvantage]: "Dis",
	[DCType.standard]: "Flat",
};

export const dcActionManifestId = "com.river.pixeldie.dc";

@action({ UUID: dcActionManifestId })
export class DCAction extends DisplayActionBase<DCSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings)

		await this.addListeners(ev);
		await ev.action.setTitle(
			this.formatTitle(settings.difficulty, settings.type)
		);
		await this.setImage(ev, settings.type);
	}

	public override async onKeyDown(ev: KeyDownEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings)

		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((settings.type + 1) % enumSize) as DCType;


		await ev.action.setSettings({
			...settings,
			type: newDCType
		});
		await ev.action.getSettings();
	}

	public override async onWillAppear(ev: WillAppearEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings)

		await ev.action.setTitle(
			this.formatTitle(settings.difficulty, settings.type)
		);
		await this.setImage(ev, settings.type);
		await this.addListeners(ev);
	}

	public override onWillDisappear(ev: WillDisappearEvent<DCSettings>): void {
		this.removeListeners(ev.action.id);
	}

	private async addListeners(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
	) {
		const settings = Settings.parse(ev.payload.settings)

		if (!settings.deviceId) {
			await ev.action.showAlert();
			await ev.action.setTitle("No\nDevice");
			this.removeListeners(ev.action.id);

			return;
		}

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.Settings,
			listener: async (event: Partial<DCSettings>) => {
				console.log("Received some settings", { event });

				await ev.action.setSettings({
					...settings,
					difficulty: settings.difficulty + event.difficulty!,
				});
				await ev.action.getSettings();
			},
		});

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelRoll,
			subscribeTo: settings.deviceId,
			listener: this.pixelListener(ev),
		});

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelDisconnect,
			subscribeTo: settings.deviceId,
			listener: async () => {
				await ev.action.showAlert();
				await ev.action.setTitle("No\nDevice");
			},
		});
	}

	private formatRoll(roll?: number | string) {
		if (typeof roll === "string") {
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

	private pixelListener(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
	) {
		const { 
			type, 
			difficulty,
			nat20Audio,
			successAudio, 
			failureAudio, 
			nat1Audio,
		} = Settings.parse(ev.payload.settings);

		let rolls: number[] = [];
		let rollingTitle: string = ': ';
		return async ({ event }: PixelRollEvent) => {
			if (event.state === 1) {
				if (rolls.length === 2 || type === DCType.standard) {
					rolls = [];
				}

				rolls.push(event.faceIndex + 1);
				const [roll1, roll2] = rolls;

				await ev.action.setTitle(this.formatTitle(difficulty, type, roll1, roll2));

				switch (type) {
					case DCType.standard: {
						if (roll1 === 20 && nat20Audio) {
							console.log('Playing nat 20');
							await soundPlayer.play(nat20Audio);
						} else if (roll1 >= difficulty && successAudio) {
							await soundPlayer.play(successAudio);
						} else if (roll1 === 1 && nat1Audio) {
							await soundPlayer.play(nat1Audio);
						} else if (roll1 < difficulty && failureAudio) {
							await soundPlayer.play(failureAudio);
						}
						break;
					}

					case DCType.advantage: {
						if ((roll1 === 20 || roll2 === 20)) {
							await ev.action.setTitle(this.formatTitle(difficulty, type, 20, 20));
							rolls = [];

							if (nat20Audio) {
								await soundPlayer.play(nat20Audio);
							}
						} else if (
							((roll1 >= difficulty && !roll2) ||
								(roll1 < difficulty && roll2 >= difficulty)) &&
							successAudio
						) {
							await soundPlayer.play(successAudio);
						} else if ((roll1 === 1 || roll2 === 1) && nat1Audio) {
							await soundPlayer.play(nat1Audio);
						} else if (roll1 < difficulty && roll2 < difficulty && failureAudio) {
							await soundPlayer.play(failureAudio);
						}

						break;
					}

					case DCType.disadvantage: {
						if (roll1 === 20 && roll2 === 20 && nat20Audio) {
							await soundPlayer.play(nat20Audio);
						} else if (roll1 >= difficulty && roll2 >= difficulty && successAudio) {
							await soundPlayer.play(successAudio);
						} else if ((roll1 === 1 || roll2 === 1)) {
							await ev.action.setTitle(this.formatTitle(difficulty, type, 1, 1));

							if (nat1Audio) {
								await soundPlayer.play(nat1Audio);
							}
							rolls = [];
						} else if (
							((roll1 < difficulty && !roll2) ||
								(roll1 >= difficulty && roll2 < difficulty)) &&
							failureAudio
						) {
							await soundPlayer.play(failureAudio);
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
		}
	}

	private async removeListeners(id: string) {
		EventBus.unsubscribe(EventType.Settings, id);
		EventBus.unsubscribe(EventType.PixelRoll, id);
		EventBus.unsubscribe(EventType.PixelDisconnect, id);
	}

	private async setImage(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
		type: DCType,
	) {
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
