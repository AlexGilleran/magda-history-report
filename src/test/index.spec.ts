import { expect } from "chai";
import "mocha";
import myFunction from "../index";

describe("Test Function", () => {
    it("should return 'Hello world!\n'", async () => {
        const result = await myFunction(undefined);
        expect(result).to.equal("Hello world!\n");
    });
});
