import { describe, expect, it } from "vitest";
import { linqOnrampStatusToOrder, linqStatusToOrder } from "./ramp-orders";

describe("Linq status words", () => {
  it("maps Linq's order statuses and webhook events to Bursr's", () => {
    expect(linqStatusToOrder("disbursed")).toBe("done");
    expect(linqStatusToOrder("Settled in treasury")).toBe("done");
    expect(linqStatusToOrder("", "order.completed")).toBe("done");
    expect(linqStatusToOrder("timeout: no deposit received")).toBe("failed");
    expect(linqStatusToOrder("failed")).toBe("failed");
    expect(linqStatusToOrder("", "order.failed")).toBe("failed");
    expect(linqStatusToOrder("processing: in bank queue")).toBe("paying");
    expect(linqStatusToOrder("", "order.processing")).toBe("paying");
    expect(linqStatusToOrder("something new")).toBeNull();
  });
});

describe("Linq naira-in status words", () => {
  it("treats only `completed` as delivered", () => {
    expect(linqOnrampStatusToOrder("completed")).toBe("done");
    expect(linqOnrampStatusToOrder("", "order.completed")).toBe("done");
    expect(linqOnrampStatusToOrder("crypto confirmed")).toBe("paying");
    expect(linqOnrampStatusToOrder("fiat received")).toBe("paying");
    expect(linqOnrampStatusToOrder("awaiting payment")).toBeNull();
    expect(linqOnrampStatusToOrder("expired")).toBe("failed");
    expect(linqOnrampStatusToOrder("fiat refunded")).toBe("failed");
    expect(linqOnrampStatusToOrder("", "order.failed")).toBe("failed");
  });
});
