import { describe, expect, it } from "vitest";
import { scopeAllows, scopesFor } from "./token-scope";

describe("token scopes", () => {
  it("keeps app tokens off MCP", () => {
    expect(scopeAllows("app", "mcp")).toBe(false);
    expect(scopesFor("mcp")).toEqual(["full"]);
  });

  it("lets both scopes capture and use the app API", () => {
    expect(scopesFor("capture")).toEqual(["full", "app"]);
    expect(scopesFor("app")).toEqual(["full", "app"]);
  });
});
