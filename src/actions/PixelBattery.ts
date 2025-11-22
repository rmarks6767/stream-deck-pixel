import streamDeck, { DidReceiveSettingsEvent, JsonObject, SendToPluginEvent } from "@elgato/streamdeck";
import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { PixelDiscover } from "../pixelHelpers/PixelDiscover";
import { pixelManager } from "../pixelHelpers/PixelManager";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.river.pixeldie.battery" })
export class PixelBattery extends PixelDiscover {
  isListening: boolean = false;
  lastBatteryUpdateTime: number | null = null;

  addListener(ev: WillAppearEvent | DidReceiveSettingsEvent): void {
    if (!this.isListening && this.selectedPixel) {
      this.isListening = true;

      pixelManager.addEventListener(this.selectedPixel.id, "batteryLevel", async (event: { levelPercent: number; }) => {
        console.log(event);
        console.log(`Battery level: ${event.levelPercent}%`);
        // if (this.lastBatteryUpdateTime === null ||
            // (Date.now() - this.lastBatteryUpdateTime) > 60000) {
          // this.lastBatteryUpdateTime = Date.now();

          await ev.action.setTitle(`${event.levelPercent}%`);
        // }
      });
    }
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await super.onWillAppear(ev);
    this.addListener(ev);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    await super.onDidReceiveSettings(ev);
    this.addListener(ev);
  }
}
