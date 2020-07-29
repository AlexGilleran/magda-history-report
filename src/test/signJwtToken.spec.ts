import {} from "mocha";
import { expect } from "chai";
import mock from "mock-fs";
import jwt from "jsonwebtoken";
import signJwtToken from "../signJwtToken";

describe("signJwtToken", () => {
    let mocked = false;

    let envVarBackup: {
        [key: string]: string;
    };

    beforeEach(() => {
        envVarBackup = { ...process.env };
    });

    afterEach(() => {
        process.env = { ...envVarBackup };
        if (mocked) {
            mock.restore();
        }
    });

    it("should load jwtSecret from `jwt-secret` file when ENV var JWT_SECRET does not exist", async () => {
        const testUserId = "test-user-id";
        const testJWTSecret = "test-jwt-secret-from-file";

        // --- mock /var/openfaas/secrets/jwt-secret
        mocked = true;

        mock({
            "/var/openfaas/secrets/jwt-secret": testJWTSecret
        });

        const jwtToken = await signJwtToken(testUserId);
        const payload = jwt.verify(jwtToken, testJWTSecret) as any;
        expect(payload.userId).to.equal(testUserId);
    });

    it("should load jwtSecret from `JWT_SECRET` ENV var when secret file (/var/openfaas/secrets/jwt-secret) does not exist", async () => {
        const testUserId = "test-user-id";
        const testJWTSecret = "test-jwt-secret-from-env";
        process.env.JWT_SECRET = testJWTSecret;

        const jwtToken = await signJwtToken(testUserId);
        const payload = jwt.verify(jwtToken, testJWTSecret) as any;
        expect(payload.userId).to.equal(testUserId);
    });
});
