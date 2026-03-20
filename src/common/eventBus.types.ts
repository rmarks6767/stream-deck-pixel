import { BatteryEvent, RollEvent } from "./pixelManager.types";

export enum EventType {
    PixelRoll = 'PIXEL_ROLL',
    PixelBattery = 'PIXEL_BATTERY',
    PixelDisconnect = 'PIXEL_DISCONNECT',
    PixelConnect = 'PIXEL_CONNECT',
    PixelRemove = 'PIXEL_REMOVE',
    Settings = 'SETTINGS',
}

export interface PixelRollEvent {
    id: string;
    event: RollEvent;
}

export interface PixelBatteryEvent {
    id: string;
    event: BatteryEvent;
}

export interface PixelDisconnectEvent {
    id: string;
}

export interface PixelConnectEvent {
    id: string;
}

export interface PixelRemoveEvent {
    id: string;
}

export type SettingsUpdateEvent<T = unknown> = Partial<T>;

export interface EventMap {
    [EventType.PixelRoll]: PixelRollEvent;
    [EventType.PixelBattery]: PixelBatteryEvent;
    [EventType.PixelDisconnect]: PixelDisconnectEvent;
    [EventType.PixelConnect]: PixelDisconnectEvent;
    [EventType.PixelRemove]: PixelRemoveEvent;
    [EventType.Settings]: SettingsUpdateEvent;
}

export type EventListener<T extends EventType> = (
    event: EventMap[T]
) => Promise<void> | void;

export interface Subscriber<T extends EventType> {
    id: string;
    subscribeTo?: string;
    type: T;
    listener: EventListener<T>;
}
