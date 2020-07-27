import { Request, Response } from "express";
import { promisify } from "util";
import CsvStream from "csv-stringify";
import jwt from "jsonwebtoken";
import { getSecretValue } from "./utils";
import RegistryEventStream from "./RegistryEventStream";
import RegistryEventTransformStream from "./RegistryEventTransformStream";

async function getUserIdFromReq(req?: Request): Promise<string | null> {
    if (!req?.header) {
        return null;
    }
    const jwtToken = req.header("X-Magda-Session");
    if (jwtToken) {
        return null;
    }
    const jwtSecret = await getSecretValue("auth-secrets", "jwt-secret");
    if (!jwtSecret) {
        throw new Error("Invalud empty jwtSecret");
    }

    const jwtPayload = await promisify<string, jwt.Secret, any>(jwt.verify)(
        jwtToken,
        jwtSecret
    );

    if (jwtPayload?.userId) {
        return jwtPayload.userId as string;
    } else {
        return null;
    }
}

function handleError(e: Error, res?: Response) {
    if (!res) {
        // work under process fork / pipe mode / local. No http server proxy
        throw e;
    } else {
        console.log(e);
        // --- we still set to 200 in case some browser won't show text body for error status code
        res.status(200).send("Error: " + e);
    }
}

/**
 * This function can be used in the following ways:
 * - Served by a HTTP server:
 *   - GET request: `recordId` parameter should be passed via query string
 *   - POST request: `recordId` parameter should be passed via query string or plain text in body (avaiable as function `input` parameter)
 *   - Response through `res`
 * - Served in CGI mode or run as commandline.
 *   - `req` & `res` parameter will not be available
 *   - `recordId` should be provided via `process.stdin`
 *   - Output through `stdout`
 *
 * @export
 * @param {*} input
 * @param {Request} [req]
 * @param {Response} [res]
 */
export default async function myFunction(
    input: any,
    req?: Request,
    res?: Response
) {
    try {
        if (req?.query?.recordId) {
            // function is served by http server and GET request
            input = req.query.recordId;
        }

        if (typeof input !== "string") {
            throw new Error("Expect record ID as input.");
        }
        const recordId = input;

        const registryApiUrl = process?.env?.["registryApiUrl"];
        if (!registryApiUrl) {
            throw new Error("Cannot locate registryApiUrl");
        }

        const authApiUrl = process?.env?.["authApiUrl"];
        if (!authApiUrl) {
            throw new Error("Cannot locate authApiUrl");
        }

        const userId = await getUserIdFromReq(req);
        const eventStream = new RegistryEventStream(registryApiUrl, recordId, {
            userId
        });
        const transformer = new RegistryEventTransformStream({
            registryApiUrl,
            authApiUrl,
            userId
        });

        const csvStream = CsvStream(
            {
                header: true
            },
            (err, data) => handleError(err, res)
        );

        if (res) {
            // http usage: function served by a http server
            res.set({
                // disable cache
                "Cache-Control": "no-cache, must-revalidate",
                Expires: "Sat, 26 Jul 1997 05:00:00 GMT",
                "Content-Type": "text/csv",
                // prompt download dialog
                "Content-Disposition": `attachment; filename-"history-${recordId.replace(
                    /[^\da-zA-Z\-]/g,
                    "-"
                )}.csv"`
            });
            eventStream
                .pipe(transformer)
                .pipe(csvStream)
                .pipe(res);
        } else {
            // work under process fork / pipe mode / local. No http server proxy
            eventStream
                .pipe(transformer)
                .pipe(csvStream)
                .pipe(process.stdout);
        }
    } catch (e) {
        handleError(e, res);
    }
}
