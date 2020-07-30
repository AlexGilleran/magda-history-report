import {} from "mocha";
import { expect } from "chai";
import nock from "nock";
import devnull from "dev-null";
import streamifyArray from "stream-array";
import { Event } from "../RegistryEventStream";
import Transformer from "../RegistryEventTransformStream";
import jwt from "jsonwebtoken";

const testStream = (
    registryApiUrl: string,
    authApiUrl: string,
    userId: string,
    data: Event[],
    onData?: (data: Event) => void
) =>
    new Promise((resolve, reject) =>
        onData
            ? streamifyArray(data)
                  .pipe(new Transformer({ registryApiUrl, authApiUrl, userId }))
                  .on("data", onData)
                  .on("error", reject)
                  .pipe(
                      devnull({
                          objectMode: true
                      })
                  )
                  .on("finish", resolve)
            : streamifyArray(data)
                  .pipe(new Transformer({ registryApiUrl, authApiUrl, userId }))
                  .on("error", reject)
                  .pipe(
                      devnull({
                          objectMode: true
                      })
                  )
                  .on("finish", resolve)
    );

describe("RegistryEventTransformStream", () => {
    let envVarBackup: {
        [key: string]: string;
    };

    const registryApiUrl = "http://registry-api.com";
    const authApiUrl = "http://auth-api.com";
    const testUserId = "test-user-id";
    const testTenantId = String(Math.ceil(Math.random() * 100));
    const jwtSecret = "test secret";

    beforeEach(() => {
        envVarBackup = { ...process.env };
        process.env.JWT_SECRET = jwtSecret;
        process.env.tenantId = testTenantId;
    });

    afterEach(() => {
        process.env = { ...envVarBackup };
        nock.cleanAll();
    });

    const checkJwtTokenHeader = (val: string | string[]) => {
        const jwtToken = (val?.[0] ? val[0] : val) as string;
        const payload = jwt.verify(jwtToken, jwtSecret) as any;
        expect(payload.userId).to.equal(testUserId);
        return true;
    };

    const checkTenantHeader = (val: string | string[]) => {
        const tenantId = val?.[0] ? val[0] : val;
        expect(tenantId).to.equal(testTenantId);
        return true;
    };

    function setupRegistryApi(recordId: string, recordName: string) {
        return nock(registryApiUrl)
            .get(uri => uri.match(/records\/([^\/]+)/)?.[1] === recordId)
            .matchHeader("X-Magda-Session", checkJwtTokenHeader)
            .matchHeader("X-Magda-Tenant-Id", checkTenantHeader)
            .reply(200, {
                aspects: {},
                authnReadPolicyId: "object.registry.record.public",
                id: recordId,
                name: recordName,
                tenantId: testTenantId
            });
    }

    function setupAuthApi(userId: string, userName: string) {
        return nock(authApiUrl)
            .get(uri => uri.match(/public\/users\/([^\/]+)/)?.[1] === userId)
            .matchHeader("X-Magda-Tenant-Id", checkTenantHeader)
            .reply(200, {
                id: userId,
                photoURL: "",
                displayName: userName,
                isAdmin: true
            });
    }

    it("should transform non-patch record event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-1";
        const testEventUserId = "test-user-id-1";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96424,
            eventTime: "2020-07-28 08:39:12.165274+00",
            eventType: "CreateRecord",
            userId: testEventUserId,
            tenantId: parseInt(testTenantId),
            data: {
                name: "",
                recordId: testRecordId,
                tenantId: testTenantId,
                authnReadPolicyId: "object.registry.record.owner_only"
            }
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "",
                "JSON Patch Operation": "",
                "JSON Path": "",
                "JSON Path Value": "",
                "JSON Value": JSON.stringify(event.data)
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should transform patch record event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-2";
        const testEventUserId = "test-user-id-2";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96435,
            eventTime: "2020-07-28 08:39:38.250277+00",
            eventType: "PatchRecord",
            data: {
                patch: [
                    {
                        op: "replace",
                        path: "/authnReadPolicyId",
                        value: "object.registry.record.public"
                    },
                    {
                        op: "replace",
                        path: "/name",
                        value: "new name"
                    },
                    { op: "remove", path: "/tenantId" }
                ],
                recordId: testRecordId,
                tenantId: parseInt(testTenantId)
            },
            tenantId: parseInt(testTenantId),
            userId: testEventUserId
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "",
                "JSON Patch Operation": "replace",
                "JSON Path": "/authnReadPolicyId",
                "JSON Path Value": "object.registry.record.public",
                "JSON Value": ""
            },
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "",
                "JSON Patch Operation": "replace",
                "JSON Path": "/name",
                "JSON Path Value": "new name",
                "JSON Value": ""
            },
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "",
                "JSON Patch Operation": "remove",
                "JSON Path": "/tenantId",
                "JSON Path Value": "",
                "JSON Value": ""
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should transform delete record event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-3";
        const testEventUserId = "test-user-id-3";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96424,
            eventTime: "2020-07-28 08:39:12.165274+00",
            eventType: "DeleteRecord",
            userId: testEventUserId,
            tenantId: parseInt(testTenantId),
            data: {
                recordId: testRecordId,
                tenantId: testTenantId
            }
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "",
                "JSON Patch Operation": "",
                "JSON Path": "",
                "JSON Path Value": "",
                "JSON Value": ""
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should transform non-patch aspsect event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-4";
        const testEventUserId = "test-user-id-4";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96443,
            eventTime: "2020-07-28 08:39:38.374367+00",
            eventType: "CreateRecordAspect",
            userId: testEventUserId,
            tenantId: parseInt(testTenantId),
            data: {
                aspect: { status: "CURRENT" },
                aspectId: "currency",
                recordId: testRecordId,
                tenantId: parseInt(testTenantId)
            }
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "currency",
                "JSON Patch Operation": "",
                "JSON Path": "",
                "JSON Path Value": "",
                "JSON Value": JSON.stringify(event.data.aspect)
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should transform patch aspect event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-5";
        const testEventUserId = "test-user-id-5";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96455,
            eventTime: "2020-07-28 08:40:02.137207+00",
            eventType: "PatchRecordAspect",
            data: {
                patch: [
                    {
                        op: "replace",
                        path: "/modified",
                        value: "2020-07-28T08:39:48.870Z"
                    },
                    {
                        op: "replace",
                        path: "/title",
                        value: "test new title"
                    },
                    {
                        op: "remove",
                        path: "/test-field"
                    }
                ],
                aspectId: "dcat-dataset-strings",
                recordId: testRecordId,
                tenantId: parseInt(testTenantId)
            },
            tenantId: parseInt(testTenantId),
            userId: testEventUserId
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "dcat-dataset-strings",
                "JSON Patch Operation": "replace",
                "JSON Path": "/modified",
                "JSON Path Value": "2020-07-28T08:39:48.870Z",
                "JSON Value": ""
            },
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "dcat-dataset-strings",
                "JSON Patch Operation": "replace",
                "JSON Path": "/title",
                "JSON Path Value": "test new title",
                "JSON Value": ""
            },
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "dcat-dataset-strings",
                "JSON Patch Operation": "remove",
                "JSON Path": "/test-field",
                "JSON Path Value": "",
                "JSON Value": ""
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should transform delete aspsect event properly", async () => {
        const testRecordName = "test record 123";
        const testRecordId = "test-record-id-6";
        const testEventUserId = "test-user-id-6";
        const testEventUserName = "test user 123";
        const resultedEvents = [] as any[];

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96443,
            eventTime: "2020-07-28 08:39:38.374367+00",
            eventType: "DeleteRecordAspect",
            userId: testEventUserId,
            tenantId: parseInt(testTenantId),
            data: {
                aspectId: "currency",
                recordId: testRecordId,
                tenantId: parseInt(testTenantId)
            }
        };

        await testStream(
            registryApiUrl,
            authApiUrl,
            testUserId,
            [event],
            data => resultedEvents.push(data)
        );

        expect(resultedEvents).to.have.deep.members([
            {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": testEventUserName,
                Time: event.eventTime,
                "Record Id": event.data.recordId,
                "Record Name": testRecordName,
                "Event type": event.eventType,
                "Aspect Id": "currency",
                "JSON Patch Operation": "",
                "JSON Path": "",
                "JSON Path Value": "",
                "JSON Value": ""
            }
        ]);

        expect(nock.isDone()).to.be.true;
    });

    it("should load names from cache rather than accessing APIs after the first access for the same Id", async () => {
        const testRecordName = "test record 1";
        const testRecordId = "test-record-id-x";
        const testEventUserId = "test-user-id-x";
        const testEventUserName = "test user 1";

        setupRegistryApi(testRecordId, testRecordName);
        setupAuthApi(testEventUserId, testEventUserName);

        const event: Event = {
            id: 96424,
            eventTime: "2020-07-28 08:39:12.165274+00",
            eventType: "CreateRecord",
            userId: testEventUserId,
            tenantId: parseInt(testTenantId),
            data: {
                name: "",
                recordId: testRecordId,
                tenantId: testTenantId,
                authnReadPolicyId: "object.registry.record.owner_only"
            }
        };

        await testStream(registryApiUrl, authApiUrl, testUserId, [event]);

        await testStream(registryApiUrl, authApiUrl, testUserId, [event]);

        await testStream(registryApiUrl, authApiUrl, testUserId, [event]);

        // nock should only be satisfied once
        expect(nock.isDone()).to.be.true;

        nock.cleanAll();

        const testRecordName2 = "test record 2";
        const testRecordId2 = "test-record-id-x-2";
        const testEventUserId2 = "test-user-id-x-2";
        const testEventUserName2 = "test user 2";

        setupRegistryApi(testRecordId2, testRecordName2);
        setupAuthApi(testEventUserId2, testEventUserName2);

        const event2: Event = {
            id: 96424,
            eventTime: "2020-07-28 08:39:12.165274+00",
            eventType: "CreateRecord",
            userId: testEventUserId2,
            tenantId: parseInt(testTenantId),
            data: {
                name: "",
                recordId: testRecordId2,
                tenantId: testTenantId,
                authnReadPolicyId: "object.registry.record.owner_only"
            }
        };

        await testStream(registryApiUrl, authApiUrl, testUserId, [event2]);

        // should access api again for new record / user id
        expect(nock.isDone()).to.be.true;
    });
});
