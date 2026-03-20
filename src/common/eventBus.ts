import { EventMap, EventType, Subscriber } from "./eventBus.types";

type SubscriberMap = {
	[K in EventType]: Map<string, Subscriber<K>>;
};

export class EventBus {
	private static subscribers: SubscriberMap = {
		[EventType.PixelRoll]: new Map(),
		[EventType.PixelBattery]:new Map(),
		[EventType.PixelConnect]: new Map(),
		[EventType.PixelDisconnect]: new Map(),
		[EventType.PixelRemove]: new Map(),
		[EventType.Settings]: new Map(),
	};

	public static async emit<T extends EventType>(type: T, event: EventMap[T] & { id: string }): Promise<void> {
		console.log('[EventBus.emit]', { type, event });
		const calls = [...this.subscribers[type]].map(([,sub]) => {
			if (!sub.subscribeTo || sub.subscribeTo === event.id) {
				sub.listener(event)
			}
		});
		await Promise.all(calls);
	}

	public static async emitTo<T extends EventType>(type: T, targetId: string, event: EventMap[T]): Promise<void> {
		console.log('[EventBus.emitTo]', { type, targetId, event });

		const calls = [...this.subscribers[type]]
			.filter(([,sub]) => sub.id === targetId)
			.map(([,sub]) => sub.listener(event));
		
		await Promise.all(calls);
	}

	public static subscribe<T extends EventType>(subscriber: Subscriber<T>): void {
		console.log('[EventBus.subscribe]', { subscriber });

		this.subscribers[subscriber.type].set(subscriber.id, subscriber);
	}

	public static unsubscribe(type: EventType, id: string): void {
		console.log('[EventBus.unsubscribe]', { type, id }); 

		this.subscribers[type].delete(id);
	}
}
