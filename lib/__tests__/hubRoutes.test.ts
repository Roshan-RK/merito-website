import { describe, it, expect } from "vitest";
import { isHubAccountRoute } from "../hubRoutes";

describe("isHubAccountRoute", () => {
  it("matches the account root", () => {
    expect(isHubAccountRoute("/hub/account")).toBe(true);
  });

  it("matches nested account routes", () => {
    expect(isHubAccountRoute("/hub/account/report")).toBe(true);
    expect(isHubAccountRoute("/hub/account/interview")).toBe(true);
    expect(isHubAccountRoute("/hub/account/personality")).toBe(true);
  });

  it("does not match the public hub marketing page", () => {
    expect(isHubAccountRoute("/hub")).toBe(false);
  });

  it("does not match the login page", () => {
    expect(isHubAccountRoute("/hub/login")).toBe(false);
  });

  it("does not match an unrelated route with a similar prefix", () => {
    expect(isHubAccountRoute("/hub/accountability")).toBe(false);
  });
});
