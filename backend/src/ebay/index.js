import { MockEbayClient } from "./client.mock.js";

// placeholder; add a real client when your keys arrive
// import { RestEbayClient } from "./client.real.js";

export function createEbayClient(env = process.env.EBAY_ENV || "mock") {
  switch (env) {
    // case "sandbox":
    // case "prod":
    //   return RestEbayClient;
    case "mock":
    default:
      return MockEbayClient;
  }
}

export const ebayClient = createEbayClient();
