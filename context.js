import { DEFAULTS } from "./config.js";

export function makeContext({ client, storage, embeds, cooldown, openrouter }) {
  return {
    client,
    storage,
    embeds,
    cooldown,
    openrouter,
    defaults: DEFAULTS
  };
}

