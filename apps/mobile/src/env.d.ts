declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE?: string;
    /** Opt-in only — production/closed beta must leave unset (fail closed). */
    EXPO_PUBLIC_ALLOW_DEGRADED_CHAT?: string;
    [key: string]: string | undefined;
  };
};
