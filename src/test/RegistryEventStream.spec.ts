import {} from "mocha";
import { expect } from "chai";
import nock from "nock";
import devnull from "dev-null";
import RegistryEventStream, {
    DEFAULT_FETCH_ASPECTS
} from "../RegistryEventStream";
import jwt from "jsonwebtoken";

const testStream = (
    registryApiUrl: string,
    recordId: string,
    options: {
        userId: string | null;
        limit?: number;
    }
) =>
    new Promise((resolve, reject) => {
        new RegistryEventStream(registryApiUrl, recordId, options)
            .on("error", reject)
            .on("end", resolve)
            .pipe(
                devnull({
                    objectMode: true
                })
            );
    });

describe("RegistryEventStream", () => {
    let envVarBackup: {
        [key: string]: string;
    };

    beforeEach(() => {
        envVarBackup = { ...process.env };
    });

    afterEach(() => {
        process.env = { ...envVarBackup };
    });

    const registryApiUrl = "http://registry-api.com";

    it("Should access history API with correct X-Magda-Session header", async () => {
        const testUserId = "test-user-id";
        const jwtSecret = "test secret";
        process.env.JWT_SECRET = jwtSecret;

        nock(registryApiUrl)
            .get(/records\/[^/]+\/history/)
            .matchHeader("X-Magda-Session", val => {
                const jwtToken = val?.[0] ? val[0] : val;
                const payload = jwt.verify(jwtToken, jwtSecret) as any;
                expect(payload.userId).to.equal(testUserId);
                return true;
            })
            .reply(200, {
                hasMore: false,
                pageToken: "",
                events: []
            });

        await testStream(registryApiUrl, "test-record-id", {
            userId: testUserId
        });
    });

    it("Should access history API with correct tenant Id", async () => {
        const testTenantId = Math.floor(Math.random() * 10000).toString();
        const testUserId = "test-user-id";
        const jwtSecret = "test secret";
        process.env.JWT_SECRET = jwtSecret;
        process.env.tenantId = testTenantId;

        nock(registryApiUrl)
            .get(/records\/[^/]+\/history/)
            .matchHeader("X-Magda-Tenant-Id", val => {
                const tenantId = val?.[0] ? val[0] : val;
                expect(tenantId).to.equal(testTenantId);
                return true;
            })
            .reply(200, {
                hasMore: false,
                pageToken: "",
                events: []
            });

        await testStream(registryApiUrl, "test-record-id", {
            userId: testUserId
        });
    });

    it("Should access history API with default tenantId 0 if cannot locate from env", async () => {
        const testUserId = "test-user-id";
        const jwtSecret = "test secret";
        process.env.JWT_SECRET = jwtSecret;

        nock(registryApiUrl)
            .get(/records\/[^/]+\/history/)
            .matchHeader("X-Magda-Tenant-Id", val => {
                const tenantId = val?.[0] ? val[0] : val;
                expect(tenantId).to.equal("0");
                return true;
            })
            .reply(200, {
                hasMore: false,
                pageToken: "",
                events: []
            });
        await testStream(registryApiUrl, "test-record-id", {
            userId: testUserId
        });
    });

    it("Should access history API with `dereference`=true and correct aspect list", async () => {
        const testUserId = "test-user-id";
        const jwtSecret = "test secret";
        process.env.JWT_SECRET = jwtSecret;

        nock(registryApiUrl)
            .get(/records\/[^/]+\/history/)
            .query(queryObj => {
                expect(queryObj?.dereference).to.equal("true");
                expect(queryObj?.aspect).to.have.members(DEFAULT_FETCH_ASPECTS);
                return true;
            })
            .reply(200, {
                hasMore: false,
                pageToken: "",
                events: []
            });

        await testStream(registryApiUrl, "test-record-id", {
            userId: testUserId
        });
    });
});
