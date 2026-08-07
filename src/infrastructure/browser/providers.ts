import { isoDateTime } from "../../domain/factories";
import type { Clock, IdProvider, RandomProvider } from "../../domain/ports";

export class SystemClock implements Clock {
  now() {
    return isoDateTime(new Date().toISOString());
  }
}

export class CryptoIdProvider implements IdProvider {
  next(namespace: string): string {
    const prefix = namespace.trim().replaceAll(/[^a-z0-9_-]/gi, "-");
    return `${prefix}:${crypto.randomUUID()}`;
  }
}

export class CryptoRandomProvider implements RandomProvider {
  next(): number {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return (values[0] ?? 0) / 0x1_0000_0000;
  }
}
