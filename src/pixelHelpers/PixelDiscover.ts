import streamDeck, { DidReceiveSettingsEvent, JsonObject, SendToPluginEvent, WillAppearEvent } from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import noble, { Peripheral } from "@stoprocent/noble";
import { Pixel, pixelManager } from "./PixelManager";

export interface DiscoverSettings extends JsonObject {
    deviceId?: string;
}

interface PluginEvent extends JsonObject {
    event: "getDevices";
}

const knownDevices = ['D20', 'D12', 'D8', 'D6', 'D4'];

export class PixelDiscover extends SingletonAction<DiscoverSettings> {
    protected selectedPixel: Pixel | null = null;
    peripherals: Map<string, Peripheral> = new Map();
    uuid: string = crypto.randomUUID();

    async connect (settings: DiscoverSettings) {
        console.log(settings.deviceId && !this.selectedPixel)

        if (settings.deviceId && (!this.selectedPixel || !this.selectedPixel.isConnected)) {
            this.selectedPixel = await pixelManager.connect(settings.deviceId, this.uuid);
        }
    }

    override async onWillAppear(ev: WillAppearEvent<DiscoverSettings>): Promise<void> {
        const settings = await ev.action.getSettings<DiscoverSettings>();

        await this.connect(settings)
    }

    private discoverDevicesAndSend = async () => {
        const devices: { label: string; value: string }[] = [];
        pixelManager.getConnectedPixels().forEach(device => {
            devices.push({
                label: `[CONNECTED] D20 ${device.id}`,
                value: device.id,
            });
        });


        await noble.waitForPoweredOnAsync(10000);
        await noble.startScanningAsync(
            // [PixelsBluetoothIds.legacyDie.service, PixelsBluetoothIds.die.service],
            // false
        );

        if (!devices.length) {
            devices.push({
                label: "None",
                value: "",
            })
        }

        await streamDeck.ui.current?.sendToPropertyInspector({
            event: "getDevices",
            items: devices,
        });
        
        noble.on('discover', async (peripheral: Peripheral) => {
            console.log("Discovered peripheral: ", peripheral.advertisement.localName, peripheral.id);

            if (knownDevices.includes(peripheral.advertisement.localName)) {
                this.peripherals.set(peripheral.id, peripheral);

                devices.push({ 
                    label: `${peripheral.advertisement.localName} (${peripheral.id})`,
                    value: peripheral.id
                });

                await streamDeck.ui.current?.sendToPropertyInspector({
                    event: "getDevices",
                    items: devices,
                });
            }
        });

        setTimeout(async () => {
            await noble.stopScanningAsync();
        }, 10000);

    }

    override async onSendToPlugin(ev: SendToPluginEvent<PluginEvent, JsonObject>): Promise<void> {
        if(ev.payload.event === "getDevices") {
            console.log("Received getDevices event");
            await this.discoverDevicesAndSend();
        }
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DiscoverSettings>): Promise<void> {        
        if (this.selectedPixel && (!ev.payload.settings.deviceId || ev.payload.settings.deviceId !== this.selectedPixel.id)) {
            await pixelManager.disconnect(this.selectedPixel.id, this.uuid);
        }
        
        await this.connect(ev.payload.settings);
        ev.action.setSettings(ev.payload.settings);
    }
}

