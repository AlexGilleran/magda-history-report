import { Request, Response, Router } from "express";

import AuthorizedRegistryClient from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
import unionToThrowable from "@magda/typescript-common/dist/util/unionToThrowable";
import { EventsPage } from "@magda/typescript-common/dist/generated/registry/api";
import { getUserIdFromJwtToken } from "@magda/typescript-common/dist/session/GetUserId";

import getSecret from "./getSecret";

const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;

const HEADERS = [
    {
        id: "eventTime",
        title: "EVENT_TIME"
    }
];
// 'id': any;
//     'eventTime': Date;
//     'eventType': EventType;
//     'userId': string;
//     'data': JsObject;
//     'tenantId': number;

const PAGE_SIZE = 100;

export default async function index() {
    const jwtSecret = await getSecret("jwt-secret");

    const router = Router();

    router.get("/:recordId", async (req: Request, res: Response<any>) => {
        const userId = getUserIdFromJwtToken(
            req.header("X-Magda-Session"),
            jwtSecret
        );

        const client = new AuthorizedRegistryClient({
            jwtSecret: jwtSecret,
            userId: userId.valueOr(null),
            baseUrl: "",
            tenantId: 0
        });

        try {
            res.setHeader("type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=" + req.params.recordId + ".csv"
            );

            const csvStringifier = createCsvStringifier({
                header: HEADERS
            });
            res.write(csvStringifier.getHeaderString());

            let history: EventsPage = null;
            do {
                console.log((client as any).jwt);
                // Fetch the record history from the registry
                history = unionToThrowable(
                    await client.getRecordHistory(
                        req.params.recordId,
                        history && history.nextPageToken,
                        null,
                        PAGE_SIZE
                    )
                );
                res.write(csvStringifier.stringifyRecords(history.events));
            } while (history.hasMore);

            res.status(200).end();
        } catch (e) {
            console.error(e);
            res.status(500).send("Error");
        }
    });

    return router;
}
