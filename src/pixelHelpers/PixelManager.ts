import { MessageType, PixelsBluetoothIds, serializer } from "@systemic-games/pixels-web-connect";
import BleSession from "./BluetoothSession";
import noble, { Peripheral } from "@stoprocent/noble";

export interface Pixel {
    type: 'd20' | 'd12' | 'd8' | 'd6'| 'd4'; 
    id: string;
    device: Peripheral;
    isConnected?: boolean;
    connectedActions: string[]
    eventListeners?: Map<string, Function>;
}

export class PixelManager {
    private pixelDevices: Map<string, Pixel> = new Map();

    public getConnectedPixels(): Pixel[] {
        console.log('Connected devices', this.pixelDevices);

        return Array.from(this.pixelDevices.values()).filter(pixel => pixel.isConnected);
    }

    public async disconnect(id: string, actionId: string): Promise<void> {
        try {
            const existingPixel = this.pixelDevices.get(id);
            if (existingPixel && existingPixel.connectedActions.includes(actionId)) {
                const newConnectedActions = existingPixel.connectedActions.filter(action => action !== actionId);

                if (!newConnectedActions.length) {
                    await this.pixelDevices.get(id)?.device.disconnectAsync();
                    this.pixelDevices.delete(id);
                } else {
                    this.pixelDevices.set(id, {
                        ...existingPixel,
                        connectedActions: newConnectedActions
                    });
                }
            }
        } catch(error) {
            console.error("Error disconnecting from Pixel device (swallowing error): ", error);
        }
    }

    public async connect(id: string, actionId: string, retry = 0): Promise<Pixel> {
        const existingPixel = this.pixelDevices.get(id);

        if (existingPixel && existingPixel.isConnected) {
            console.log(`Pixel device with id ${id} is already connected`);
            if (!existingPixel.connectedActions.includes(actionId)) {
                existingPixel.connectedActions.push(actionId);
            }

            return existingPixel;
        } else if (existingPixel) {
            console.log(`Pixel device with id ${id} found but not connected, removing from manager`);
            this.pixelDevices.delete(id);
        }

        try {
            await noble.waitForPoweredOnAsync(10000);
            const peripheral = await noble.connectAsync(id, { timeout: 10000 });

            console.log(`Connected to peripheral: ${peripheral.id}`, peripheral);

            const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync()

            const notify = characteristics.find((c) => c.properties?.includes?.("notify"));
            const write = characteristics.find((c) => c.properties?.includes?.("write"));

            console.log(characteristics);

            if (!notify || !write) {
                console.error("Required characteristics not found on Pixel device");

                throw new Error("Required characteristics not found on Pixel device");
            }

            peripheral.on("disconnect", () => {
                console.log(`Pixel device with id ${id} disconnected`);
                this.pixelDevices.set(id, {
                    ...this.pixelDevices.get(id) as Pixel,
                    isConnected: false,
                    connectedActions: [],
                });
            });

            const eventListeners: Map<string, Function> = new Map();
            notify.on('data', (data: Buffer) => {
                const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

                const message = serializer.deserializeMessage(dataView);
                const messageType = serializer.getMessageType(message);

                console.log(messageType);
                console.log(eventListeners.keys());

                if (eventListeners.has(messageType)) {
                    const listener = eventListeners.get(messageType) as Function;

                    listener(message);
                }
            });

            await notify.subscribeAsync();
           
            const newPixel: Pixel = {
                type: 'd20',
                id,
                device: peripheral,
                isConnected: true,
                eventListeners,
                connectedActions: [actionId]
            }

            this.pixelDevices.set(id, newPixel);

            console.log(`Connected to Pixel device with id ${id}`);

            return newPixel;
        } catch(error) {
            console.error("Error connecting to Pixel device:", error);

            if (retry < 3) {
                console.log(`Retrying connection to Pixel device with id ${id} (attempt ${retry + 2})`);
                return await this.connect(id, actionId, retry + 1);
            }

            throw error;
        }
       
    }

    public addEventListener(id: string,  type: MessageType, listener: Function): void {
        const pixel = this.pixelDevices.get(id);
        
        if (!pixel) {
            throw new Error(`Pixel device with id ${id} not found`);
        }

        this.pixelDevices.get(id)?.eventListeners?.set(type, listener);
    }
}

export const pixelManager = new PixelManager();