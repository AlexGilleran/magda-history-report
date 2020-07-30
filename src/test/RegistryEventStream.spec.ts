import {} from "mocha";
import { expect } from "chai";
import nock from "nock";
import devnull from "dev-null";
import RegistryEventStream, {
    DEFAULT_FETCH_ASPECTS,
    Event
} from "../RegistryEventStream";
import jwt from "jsonwebtoken";
import urijs from "urijs";

const testStream = (
    registryApiUrl: string,
    recordId: string,
    options: {
        userId: string | null;
        limit?: number;
    },
    onData?: (data: Event) => void
) =>
    new Promise((resolve, reject) =>
        onData
            ? new RegistryEventStream(registryApiUrl, recordId, options)
                  .on("data", onData)
                  .on("error", reject)
                  .pipe(
                      devnull({
                          objectMode: true
                      })
                  )
                  .on("finish", resolve)
            : new RegistryEventStream(registryApiUrl, recordId, options)
                  .on("error", reject)
                  .pipe(
                      devnull({
                          objectMode: true
                      })
                  )
                  .on("finish", resolve)
    );

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

    after(() => {
        nock.cleanAll();
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

        expect(nock.isDone()).to.be.true;
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

        expect(nock.isDone()).to.be.true;
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

        expect(nock.isDone()).to.be.true;
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

        expect(nock.isDone()).to.be.true;
    });

    it("Should access history API with proper pagination", async function(this) {
        const testUserId = "test-user-id";
        const jwtSecret = "test secret";
        process.env.JWT_SECRET = jwtSecret;

        const pageNum = 5;
        const recordNumPerPage = 3;
        const generatedEvents: Event[] = [];
        const fetchedEvents: Event[] = [];

        for (let i = 0; i < pageNum; i++) {
            for (let j = 0; j < recordNumPerPage; j++) {
                generatedEvents.push({
                    eventTime: new Date().toISOString(),
                    eventType: "createRecord",
                    id: generatedEvents.length,
                    userId: "xxxxx-xxxx-xxxx-xxxx",
                    tenantId: 0,
                    data: Math.random()
                });
            }
        }

        nock(registryApiUrl)
            .get(/records\/[^/]+\/history/)
            .query(queryObj => {
                expect(queryObj?.dereference).to.equal("true");
                expect(queryObj?.aspect).to.have.members(DEFAULT_FETCH_ASPECTS);
                return true;
            })
            .times(pageNum)
            .reply(200, function(uri, requestBody) {
                const queryParams = urijs(uri).search(true);
                const pageToken = queryParams["pageToken"];

                const limit = parseInt(queryParams["limit"]);
                if (typeof limit !== "number") {
                    throw new Error("Invalid limit parameter");
                }

                // we use array idx as pageToken
                const idx = pageToken ? parseInt(pageToken) : 0;
                if (typeof idx !== "number") {
                    throw new Error("Invalid pageToken parameter");
                }

                // array.slice will return items that not include the item at endIdx
                const endIdx = idx + limit;
                const hasMore = endIdx >= generatedEvents.length ? false : true;

                return {
                    hasMore,
                    nextPageToken: hasMore ? endIdx : undefined,
                    events: generatedEvents.slice(idx, endIdx)
                };
            });

        await testStream(
            registryApiUrl,
            "test-record-id",
            {
                userId: testUserId,
                limit: recordNumPerPage
            },
            event => fetchedEvents.push(event)
        );

        expect(nock.isDone()).to.be.true;

        expect(generatedEvents).to.have.deep.members(
            fetchedEvents.sort((a, b) => a.id - b.id)
        );
    });
});
