import chai, { expect } from "chai";
chai.use(require("chai-as-promised"));
import "mocha";
import main from "../index";

describe("Test Main Function", () => {
    it("should throw `Expect record ID as input` if no recordIs is provided", async () => {
        await expect(main(undefined)).to.be.rejectedWith(
            "Expect record ID as input"
        );
    });
});
