import streamDeck, { JsonObject, SendToPluginEvent } from "@elgato/streamdeck";
import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import noble, { Peripheral } from "@stoprocent/noble";
import { PixelSession, Pixel  } from "@systemic-games/pixels-core-connect";

interface PixelSettings extends JsonObject {
  deviceName?: string;
  dc?: number;
}

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.river.pixeldie.connect" })
export class PixelController extends SingletonAction<PixelSettings> {
  pixel: Pixel  | null = null;

  /**
   * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
   * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
   * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
   */
  override async onWillAppear(
    ev: WillAppearEvent<PixelSettings>
  ): Promise<void> {
    const { settings } = ev.payload;

    // TODO: Add configuration for which device to connect to?
    if (!settings.deviceName) {
      await ev.action.setTitle("Loading...");
      await this.connectToPixel();

      if (this.pixel) {
        await ev.action.setTitle(
          this.pixel.name || "Pixel Device"
        );
      } else {
        await ev.action.showAlert();
        await ev.action.setTitle("No Pixel Found");
      }
    }

    await streamDeck.ui.current?.sendToPropertyInspector({
      event: "settingsUpdate",
      settings,
    });
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<any, PixelSettings>
  ): Promise<void> {
    const { event, payload } = ev.payload;
  }

  /**
   * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
   * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
   * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
   * settings using `setSettings` and `getSettings`.
   */
  override async onKeyDown(ev: KeyDownEvent<PixelSettings>): Promise<void> {
    // Update the count from the settings.
    let count = ev.payload.settings.count ?? 0;

    // Update the current count in the action's settings, and change the title.
    await ev.action.setSettings({ count });
    await ev.action.setTitle(`${count}`);
  }

  // private async handleSaveSettings(ev: SendToPluginEvent<any, PixelSettings>, settings: PixelSettings): Promise<void> {
  // 	// Update settings
  // 	await ev.action.setSettings(settings);

  // 	// Update title
  // 	if (settings.deviceName) {
  // 		if ((ev.action as any).isKey?.()) {
  // 			await (ev.action as any).setTitle(settings.deviceName);
  // 		} else if ((ev.action as any).isDial?.()) {
  // 			await (ev.action as any).setTitle(settings.deviceName);
  // 		}
  // 	}

  // 	// Confirm save
  // 	await streamDeck.ui.current?.sendToPropertyInspector({
  // 		event: "settingsSaved"
  // 	});
  // }

  	private async connectToPixel(): Promise<void> {
	    console.log("Connecting to Pixel device...");

		await noble.waitForPoweredOnAsync(10000);
		await noble.startScanningAsync(
			[
				"a6b90001-7a5a-43f2-a962-350c8edc9b5b",
				"6e400001-b5a3-f393-e0a9-e50e24dcca9e",
			],
			false
    	);

		let pixelDevice = undefined;
		for await (const peripheral of noble.discoverAsync()) {
		if (peripheral.advertisement.localName === "D20") {
			pixelDevice = peripheral;
			console.log("Pixel device found:", peripheral.id);
			break;
		}

		if (pixelDevice) {
			this.pixel = new Pixel(new BleSession(peripheral.id, peripheral.advertisement.localName || "Pixel"));
		}
    }

    await noble.stopScanningAsync();
	}
//   private async connectToPixelOld(): Promise<void> {
//     // Placeholder for connection logic
//     console.log("Connecting to Pixel device...");

//     await noble.waitForPoweredOnAsync(10000);
//     await noble.startScanningAsync(
//       [
//         "a6b90001-7a5a-43f2-a962-350c8edc9b5b",
//         "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
//       ],
//       false
//     );

//     let pixelDevice = undefined;

//     for await (const peripheral of noble.discoverAsync()) {
//       if (peripheral.advertisement.localName === "D20") {
//         pixelDevice = peripheral;
//         console.log("Pixel device found:", peripheral.id);
//         break;
//       }
//     }

//     await noble.stopScanningAsync();

//     if (pixel) {
//       await pixel.connectAsync();
//       console.log("Connected to Pixel device:", pixel.id);

//       const { services, characteristics } =
//         await pixel.discoverAllServicesAndCharacteristicsAsync();

//       const notifyCharacteristic = characteristics.find(
//         (c) => c.uuid === "6e400001b5a3f393e0a9e50e24dcca9e"
//       );

//       console.log("Subscribing to notifications...", characteristics);

//       notifyCharacteristic?.on(
//         "data",
//         (data: Buffer) => {
//           console.log("Received data from Pixel:", data);
// 		  const message = serializer.decodeMessage(data);

// 		  console.log("Decoded message:", message);
//         }
//       );

//       await notifyCharacteristic?.subscribeAsync();

//       console.log(
//         "Discovered services and characteristics:",
//         services,
//         characteristics
//       );
//       this.pixelPeripheral = pixel;
//     } else {
//       console.log("Pixel device not found.");
//     }
//   }
}
