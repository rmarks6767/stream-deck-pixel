import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import z from "zod";

import { EventBus } from "../common/eventBus";
import { EventType, PixelRollEvent } from "../common/eventBus.types";
import { PixelManager } from "../common/pixelManager";
import { soundPlayer } from "../playSound";
import { DisplayActionBase } from "./DisplayActionBase";

enum DCType {
	Advantage = 0,
	Disadvantage = 1,
	Standard = 2,
}

const Settings = z.object({
	deviceId: z.string().default(""),
	defaultTitle: z.string().default(""),
	previousDeviceId: z.string().default(""),
	type: z.enum(DCType).default(DCType.Standard),
	difficulty: z.number().default(10),
	nat20Audio: z.string().default(""),
	nat1Audio: z.string().default(""),
	successAudio: z.string().default(""),
	failureAudio: z.string().default(""),
});

type DCSettings = z.infer<typeof Settings>;

const dcTypeTitles = {
	[DCType.Advantage]: "Adv",
	[DCType.Disadvantage]: "Dis",
	[DCType.Standard]: "Flat",
};

export const dcActionManifestId = "com.river.pixeldie.dc";

@action({ UUID: dcActionManifestId })
export class DCAction extends DisplayActionBase<DCSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings);

		await this.addListeners(ev);

		if (settings.deviceId) {
			await ev.action.setTitle(this.formatTitle(settings.difficulty, settings.type));
		}

		await this.setImage(ev, settings.type);
		await ev.action.setSettings({
			...settings,
			previousDeviceId: settings.deviceId,
		});
	}

	public override async onKeyDown(ev: KeyDownEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings);

		const enumSize = Object.values(DCType).filter((v) => typeof v === "number").length;
		const newDCType = ((settings.type + 1) % enumSize) as DCType;

		await ev.action.setSettings({
			...settings,
			type: newDCType,
		});
		await ev.action.getSettings();
	}

	public override async onWillAppear(ev: WillAppearEvent<DCSettings>): Promise<void> {
		const settings = Settings.parse(ev.payload.settings);

		await this.setImage(ev, settings.type);
		await this.addListeners(ev);
	}

	public override onWillDisappear(ev: WillDisappearEvent<DCSettings>): void {
		super.onWillDisappear(ev);

		this.removeListeners(ev.action.id);
	}

	protected override async addListeners(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
	) {
		const settings = Settings.parse(ev.payload.settings);

		const newEv = {
			...ev,
			payload: {
				...ev.payload,
				settings: {
					...ev.payload.settings,
					defaultTitle: this.formatTitle(settings.difficulty, settings.type),
				},
			},
		} as typeof ev;

		await super.addListeners(
			newEv,
			settings.deviceId !== settings.previousDeviceId,
		);

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.Settings,
			listener: async (event: Partial<DCSettings>) => {
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
	}

	protected override async removeListeners(id: string) {
		EventBus.unsubscribe(EventType.Settings, id);
		EventBus.unsubscribe(EventType.PixelRoll, id);
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
		if (type === DCType.Standard) {
			return `${difficulty}\n[${this.formatRoll(roll1)}]\n${dcTypeTitles[type]}`;
		}

		return `${difficulty}\n[${this.formatRoll(roll1)}][${this.formatRoll(roll2)}]\n${dcTypeTitles[type]}`;
	}

	private pixelListener(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
	) {
		const { type, difficulty, nat20Audio, successAudio, failureAudio, nat1Audio } = Settings.parse(ev.payload.settings);

		let rolls: number[] = [];
		let rollingTitle: string = ": ";
		return async ({ event }: PixelRollEvent) => {
			if (event.state === 1) {
				if (rolls.length === 2 || type === DCType.Standard) {
					rolls = [];
				}

				rolls.push(event.faceIndex + 1);
				const [roll1, roll2] = rolls;

				await ev.action.setTitle(this.formatTitle(difficulty, type, roll1, roll2));

				switch (type) {
					case DCType.Standard: {
						if (roll1 === 20 && nat20Audio) {
							console.log("Playing nat 20");
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

					case DCType.Advantage: {
						if (roll1 === 20 || roll2 === 20) {
							await ev.action.setTitle(this.formatTitle(difficulty, type, 20, 20));
							rolls = [];

							if (nat20Audio) {
								await soundPlayer.play(nat20Audio);
							}
						} else if (
							((roll1 >= difficulty && !roll2) || (roll1 < difficulty && roll2 >= difficulty)) &&
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

					case DCType.Disadvantage: {
						if (roll1 === 20 && roll2 === 20 && nat20Audio) {
							await soundPlayer.play(nat20Audio);
						} else if (roll1 >= difficulty && roll2 >= difficulty && successAudio) {
							await soundPlayer.play(successAudio);
						} else if (roll1 === 1 || roll2 === 1) {
							await ev.action.setTitle(this.formatTitle(difficulty, type, 1, 1));

							if (nat1Audio) {
								await soundPlayer.play(nat1Audio);
							}
							rolls = [];
						} else if (
							((roll1 < difficulty && !roll2) || (roll1 >= difficulty && roll2 < difficulty)) &&
							failureAudio
						) {
							await soundPlayer.play(failureAudio);
						}

						break;
					}
				}
			} else if (event.state === 3) {
				if (rolls.length === 2 || type === DCType.Standard) {
					rolls = [];
				}

				const [roll1, roll2] = rolls;

				await ev.action.setTitle(this.formatTitle(difficulty, type, roll1 || rollingTitle, roll2 || rollingTitle));

				rollingTitle = rollingTitle === ": " ? " :" : ": ";
			}
		};
	}

	private async setImage(
		ev: DidReceiveSettingsEvent<DCSettings> | KeyDownEvent<DCSettings> | WillAppearEvent<DCSettings>,
		type: DCType,
	) {
		console.info(`[DCAction.setImage]: Event Received`, { event: ev });

		switch (type) {
			case DCType.Standard:
				await ev.action.setImage("imgs/d20_flat");
				break;
			case DCType.Advantage:
				await ev.action.setImage("imgs/d20_adv");
				break;
			case DCType.Disadvantage:
				await ev.action.setImage("imgs/d20_dis");
		}
	}
}
