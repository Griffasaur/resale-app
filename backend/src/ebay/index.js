import { MockEbayClient } from "./client.mock.js";
import { RestEbayClient } from "./client.real.js";

export function createEbayClient(env = process.env.EBAY_ENV || "mock") {
  const mode = String(env).toLowerCase();
  if (mode === "sandbox" || mode === "prod" || mode === "production") {
    return RestEbayClient;
  }
  return MockEbayClient;
}

export const ebayClient = createEbayClient();

