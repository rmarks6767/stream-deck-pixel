import { DidReceiveSettingsEvent, KeyDownEvent } from "@elgato/streamdeck";
import { action, WillAppearEvent } from "@elgato/streamdeck";
import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";
import { Player } from "../playSound";

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
	public override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<PixelDCSettings>
	): Promise<void> {
		await super.onDidReceiveSettings(ev);

		this.registerListener(ev);
	}
  
	public override async onKeyDown(ev: KeyDownEvent<PixelDCSettings>): Promise<void> {
		const { type = DCType.standard } = ev.payload.settings;

		await ev.action.setSettings({
			...ev.payload.settings,
			type: DCType[type + (1 % Object.keys(DCType).length)],
		});
	}

	public override async onWillAppear(
		ev: WillAppearEvent<PixelDCSettings>
	): Promise<void> {
		await super.onWillAppear(ev);

		const { difficulty = 10, type = DCType.standard } = ev.payload.settings;

		// ev.action.s

		this.registerListener(ev);
	}
  
	private registerListener(
		ev:
      DidReceiveSettingsEvent<PixelDCSettings> | WillAppearEvent<PixelDCSettings>
	) {
		console.log(
      `[PixelDC.${ev.action.id}] Registering listener for ${ev.payload.settings.deviceId}`
		);

		if (ev.payload.settings.deviceId) {
			this.pixelManager.addEventListener(
				ev.payload.settings.deviceId,
				ev.action.id,
				"rollState",
				async (event: { /**
																				 *
																				 */
        state: number; /**
                        *
                        */
        faceIndex: number }) => {
					console.log(event);

					if (event.state === 1) {
						if (event.faceIndex === 19 && ev.payload.settings.nat20Audio) {
							// const successSoundPath = path.resolve(__dirname, '..', 'assets', 'sounds', 'success.mp3');
							// const successSoundFileUrl = url.pathToFileURL(successSoundPath).href;

							await soundPlayer.play(ev.payload.settings.nat20Audio);
						}

						await ev.action.setTitle(`${event.faceIndex + 1}`);
					} else if (event.state === 3) {
						await ev.action.setTitle("Rolling...");
					}
				}
			);
		}
	}
}
