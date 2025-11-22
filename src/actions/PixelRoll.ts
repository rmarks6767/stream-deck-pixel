import { DidReceiveSettingsEvent } from "@elgato/streamdeck";
import {
  action,
} from "@elgato/streamdeck";
import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";
import { pixelManager } from "../pixelHelpers/PixelManager";
// import { Player } from "../playSound";
// import path from "node:path";
// import url, { fileURLToPath } from "node:url";

// const soundPlayer = new Player();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

@action({ UUID: "com.river.pixeldie.roll" })
export class PixelRoll extends PixelDiscover {
  isListening: boolean = false;
    
  registerListener(ev: DidReceiveSettingsEvent<DiscoverSettings>) {
    if (!this.isListening && this.selectedPixel) {
      this.isListening = true;

      pixelManager.addEventListener(this.selectedPixel.id, "rollState", async (event: { state: number; faceIndex: number }) => {
        if (event.state === 1) {
          // if (event.faceIndex === 19) {
          //   // const successSoundPath = path.resolve(__dirname, '..', 'assets', 'sounds', 'success.mp3');
          //   // const successSoundFileUrl = url.pathToFileURL(successSoundPath).href;

          //   // await soundPlayer.play("assets/sounds/success.mp3", {
          //   //   powershell: [
          //   //     '-NoProfile',
          //   //     '-ExecutionPolicy', 'Bypass',
          //   //     '-WindowStyle', 'Hidden',
          //   //     '-Command',
          //   //     `Add-Type -AssemblyName PresentationCore; $m = New-Object System.Windows.Media.MediaPlayer; $m.Open([Uri] '${successSoundFileUrl}'); $m.Play(); while(-not $m.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 100 }; Start-Sleep -Seconds [Math]::Ceiling($m.NaturalDuration.TimeSpan.TotalSeconds); $m.Close()`
          //   //   ]
          //   // });
          // }

          await ev.action.setTitle(`${event.faceIndex + 1}`);
        } else if (event.state === 3) {
          await ev.action.setTitle("Rolling...");
        }
      });
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DiscoverSettings>): Promise<void> {
    await super.onDidReceiveSettings(ev);

    this.registerListener(ev);
  }

  // override async onKeyDown(ev: KeyDownEvent): Promise<void> {
  //   console.log("PixelController.onKeyDown", ev);
  //   // await this.connectToPixel(ev);
  // }

  // private async connectToPixel(ev: WillAppearEvent | KeyDownEvent): Promise<void> {
  //   try {
  //     if (this.pixel) {
  //       await this.pixel.disconnect();
  //       this.pixel = null;
  //     }

  //     await ev.action.setTitle("Searching...");
  //     const peripheral = await PixelsDevices.requestDevice();

  //     this.pixel = new Pixel(peripheral.id);

  //     this.pixel.addEventListener("rollState", async (event: { state: number; faceIndex: number }) => {
  //       if (event.state === 1) {
  //         await ev.action.setTitle(`${event.faceIndex + 1}`);
  //       } else if (event.state === 3) {
  //         await ev.action.setTitle("Rolling...");
  //       }
  //     });

  //     // this.pixel.addEventListener("batteryUpdate", (event: any) => {
  //     //   console.log(`Battery level: ${event.level}%`);
  //     // });

  //     await this.pixel.connect();
  //     await ev.action.setTitle(this.pixel.getPixelName() || "Pixel Connected");
  //   } catch (err) {
  //     console.error("Error connecting to Pixel device:", err);
  //     await ev.action.setTitle("No Pixel Found");
  //     ev.action.showAlert();
  //     return;
  //   }
  // }

    // private handlePixelBatteryUpdate = (level: number) => {
    //   console.log(`Battery level: ${level}%`);


    // }

}
