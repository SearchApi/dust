/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
/**
 * Ampli - A strong typed wrapper for your Analytics
 *
 * This file is generated by Amplitude.
 * To update run 'ampli pull dust-browser-prod'
 *
 * Required dependencies: @amplitude/analytics-browser@^1.3.0
 * Tracking Plan Version: 2
 * Build: 1.0.0
 * Runtime: browser:typescript-ampli-v2
 *
 * [View Tracking Plan](https://data.amplitude.com/dust-tt/dust-prod/events/main/latest)
 *
 * [Full Setup Instructions](https://data.amplitude.com/dust-tt/dust-prod/implementation/dust-browser-prod)
 */

import * as amplitude from "@amplitude/analytics-browser";

export type Environment = "dustprod";

export const ApiKey: Record<Environment, string> = {
  dustprod: "940c526d7c7c91a38c267be75c958890",
};

/**
 * Default Amplitude configuration options. Contains tracking plan information.
 */
export const DefaultConfiguration: BrowserOptions = {
  plan: {
    version: "2",
    branch: "main",
    source: "dust-browser-prod",
    versionId: "4e855190-0d49-4fdc-a164-e1e974880832",
  },
  ...{
    ingestionMetadata: {
      sourceName: "browser-typescript-ampli",
      sourceVersion: "2.0.0",
    },
  },
};

export interface LoadOptionsBase {
  disabled?: boolean;
}

export type LoadOptionsWithEnvironment = LoadOptionsBase & {
  environment: Environment;
  client?: { configuration?: BrowserOptions };
};
export type LoadOptionsWithApiKey = LoadOptionsBase & {
  client: { apiKey: string; configuration?: BrowserOptions };
};
export type LoadOptionsWithClientInstance = LoadOptionsBase & {
  client: { instance: BrowserClient };
};

export type LoadOptions =
  | LoadOptionsWithEnvironment
  | LoadOptionsWithApiKey
  | LoadOptionsWithClientInstance;

export interface IdentifyProperties {
  email?: string;
  SignupDate?: string;
}

export interface PageViewedProperties {
  pathname: string;
}

export interface QuickGuideViewedProperties {
  /**
   * | Rule | Value |
   * |---|---|
   * | Type | number |
   */
  duration: number;
  workspaceId: string;
  workspaceName: string;
}

export class Identify implements BaseEvent {
  event_type = amplitude.Types.SpecialEventType.IDENTIFY;

  constructor(public event_properties?: IdentifyProperties) {
    this.event_properties = event_properties;
  }
}

export class PageViewed implements BaseEvent {
  event_type = "PageViewed";

  constructor(public event_properties: PageViewedProperties) {
    this.event_properties = event_properties;
  }
}

export class QuickGuideViewed implements BaseEvent {
  event_type = "QuickGuideViewed";

  constructor(public event_properties: QuickGuideViewedProperties) {
    this.event_properties = event_properties;
  }
}

export type PromiseResult<T> = { promise: Promise<T | void> };

const getVoidPromiseResult = () => ({ promise: Promise.resolve() });

// prettier-ignore
export class Ampli {
  private disabled: boolean = false;
  private amplitude?: BrowserClient;

  get client(): BrowserClient {
    this.isInitializedAndEnabled();
    return this.amplitude!;
  }

  get isLoaded(): boolean {
    return this.amplitude != null;
  }

  private isInitializedAndEnabled(): boolean {
    if (!this.amplitude) {
      console.error('ERROR: Ampli is not yet initialized. Have you called ampli.load() on app start?');
      return false;
    }
    return !this.disabled;
  }

  /**
   * Initialize the Ampli SDK. Call once when your application starts.
   *
   * @param options Configuration options to initialize the Ampli SDK with.
   */
  load(options: LoadOptions): PromiseResult<void> {
    this.disabled = options.disabled ?? false;

    if (this.amplitude) {
      console.warn('WARNING: Ampli is already intialized. Ampli.load() should be called once at application startup.');
      return getVoidPromiseResult();
    }

    let apiKey: string | null = null;
    if (options.client && 'apiKey' in options.client) {
      apiKey = options.client.apiKey;
    } else if ('environment' in options) {
      apiKey = ApiKey[options.environment];
    }

    if (options.client && 'instance' in options.client) {
      this.amplitude = options.client.instance;
    } else if (apiKey) {
      this.amplitude = amplitude.createInstance();
      const configuration = (options.client && 'configuration' in options.client) ? options.client.configuration : {};
      return this.amplitude.init(apiKey, undefined, { ...DefaultConfiguration, ...configuration });
    } else {
      console.error("ERROR: ampli.load() requires 'environment', 'client.apiKey', or 'client.instance'");
    }

    return getVoidPromiseResult();
  }

  /**
   * Identify a user and set user properties.
   *
   * @param userId The user's id.
   * @param properties The user properties.
   * @param options Optional event options.
   */
  identify(
    userId: string | undefined,
    properties?: IdentifyProperties,
    options?: EventOptions,
  ): PromiseResult<Result> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    if (userId) {
      options = {...options,  user_id: userId};
    }

    const amplitudeIdentify = new amplitude.Identify();
    const eventProperties = properties;
    if (eventProperties != null) {
      for (const [key, value] of Object.entries(eventProperties)) {
        amplitudeIdentify.set(key, value);
      }
    }
    return this.amplitude!.identify(
      amplitudeIdentify,
      options,
    );
  }

 /**
  * Flush the event.
  */
  flush() : PromiseResult<Result> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    return this.amplitude!.flush();
  }

  /**
   * Track event
   *
   * @param event The event to track.
   * @param options Optional event options.
   */
  track(event: Event, options?: EventOptions): PromiseResult<Result> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    return this.amplitude!.track(event, undefined, options);
  }

  /**
   * PageViewed
   *
   * [View in Tracking Plan](https://data.amplitude.com/dust-tt/dust-prod/events/main/latest/PageViewed)
   *
   * Event has no description in tracking plan.
   *
   * @param properties The event's properties (e.g. pathname)
   * @param options Amplitude event options.
   */
  pageViewed(
    properties: PageViewedProperties,
    options?: EventOptions,
  ) {
    return this.track(new PageViewed(properties), options);
  }

  /**
   * QuickGuideViewed
   *
   * [View in Tracking Plan](https://data.amplitude.com/dust-tt/dust-prod/events/main/latest/QuickGuideViewed)
   *
   * Event has no description in tracking plan.
   *
   * @param properties The event's properties (e.g. duration)
   * @param options Amplitude event options.
   */
  quickGuideViewed(
    properties: QuickGuideViewedProperties,
    options?: EventOptions,
  ) {
    return this.track(new QuickGuideViewed(properties), options);
  }
}

export const ampli = new Ampli();

// BASE TYPES
type BrowserOptions = amplitude.Types.BrowserOptions;

export type BrowserClient = amplitude.Types.BrowserClient;
export type BaseEvent = amplitude.Types.BaseEvent;
export type IdentifyEvent = amplitude.Types.IdentifyEvent;
export type GroupEvent = amplitude.Types.GroupIdentifyEvent;
export type Event = amplitude.Types.Event;
export type EventOptions = amplitude.Types.EventOptions;
export type Result = amplitude.Types.Result;
