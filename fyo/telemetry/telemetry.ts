import { Fyo } from 'fyo';
import { Noun, Verb } from './types';

/**
 * ArthivoX does not send inherited usage telemetry.
 * The manager remains API-compatible so accounting models can log lifecycle
 * events without creating network traffic.
 */
export class TelemetryManager {
  #started = false;
  fyo: Fyo;

  constructor(fyo: Fyo) {
    this.fyo = fyo;
  }

  get hasCreds() { return false; }
  get started() { return this.#started; }

  async start(_isOpened?: boolean) { this.#started = true; }
  stop() { this.#started = false; }
  log(_verb: Verb, _noun: Noun, _more?: Record<string, unknown>) {}
  async logOpened() {}
}
